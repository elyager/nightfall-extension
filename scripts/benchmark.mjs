import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const extensionPath = resolve('.output/chrome-mv3');
const testRoot = mkdtempSync(join(tmpdir(), 'nightfall-benchmark-'));
const testExtensionPath = join(testRoot, 'extension');
cpSync(extensionPath, testExtensionPath, { recursive: true });
const testManifestPath = join(testExtensionPath, 'manifest.json');
const testManifest = JSON.parse(readFileSync(testManifestPath, 'utf8'));
testManifest.host_permissions = testManifest.optional_host_permissions;
delete testManifest.optional_host_permissions;
writeFileSync(testManifestPath, JSON.stringify(testManifest));
writeFileSync(
  join(testExtensionPath, 'stale-content.js'),
  `globalThis.__nightfallContentInstanceV1 = true;
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GET_STATUS') return;
  sendResponse({
    ok: true,
    status: {
      mode: 'slate-blue', active: false, nativeDark: false, path: 'off',
      startupMs: 0, processedNodes: 0,
    },
  });
});`,
);
const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));

if (!executablePath) {
  throw new Error('Chrome was not found. Set CHROME_PATH and run npm run benchmark again.');
}

const fixture = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      html, body { margin: 0; background: white; color: #222; font: 16px system-ui; }
      main { padding: 32px; }
      .card { width: 520px; padding: 24px; border: 1px solid #ddd; background: #fff; }
      .card.dark-route { background: #080a0e; color: #f4f6f8; }
      .route-shell { margin-top: 16px; background: transparent; }
      .route-panel { padding: 18px; background: #f7f8fa; color: #181a1f; }
      button { padding: 10px 14px; }
      .dropdown { position: relative; display: inline-block; }
      .dropdown-menu { position: absolute; visibility: hidden; min-width: 180px; background: #fff; border: 1px solid #ddd; }
      .dropdown:hover .dropdown-menu { visibility: visible; }
      .dropdown-item { display: block; padding: 8px 12px; color: #222; }
      .dropdown-item:hover { background: #f2f2f2; }
      img { display: block; width: 160px; height: 90px; margin-top: 16px; }
      .modal { position: fixed; inset: 20% 25%; padding: 30px; background: #fff; color: #111; }
    </style>
  </head>
  <body>
    <main><div class="card"><h1>Benchmark page</h1><p>Readable ordinary text.</p><button id="action">Action</button><div class="dropdown"><button class="dropdown-toggle">Menu</button><div class="dropdown-menu"><a class="dropdown-item" href="#item">Dropdown item</a></div></div><img alt="Protected media" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'%3E%3Crect width='160' height='90' fill='%23e85d75'/%3E%3Ccircle cx='80' cy='45' r='28' fill='%23456fe8'/%3E%3C/svg%3E"></div></main>
    <script>setTimeout(() => { const modal = document.createElement('div'); modal.className = 'modal'; modal.textContent = 'SPA navigation content'; document.body.append(modal); }, 250);</script>
  </body>
</html>`;

const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(fixture);
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;

const browser = await puppeteer.launch({
  executablePath,
  headless: process.env.HEADFUL !== '1',
  pipe: true,
  enableExtensions: [testExtensionPath],
});

try {
  const workerTarget = await browser.waitForTarget(
    (target) => target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'),
    { timeout: 10_000 },
  );
  const worker = await workerTarget.worker();
  const loadedManifest = await worker.evaluate(() => chrome.runtime.getManifest());
  if (loadedManifest.name !== 'Nightfall') {
    throw new Error(`Unexpected extension loaded: ${loadedManifest.name}`);
  }
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      nightfallSettings: {
        revision: 0,
        mode: 'slate-blue',
        sites: {
          '127.0.0.1': { enabled: true, mode: 'slate-blue' },
        },
      },
    });
  });

  const page = await browser.newPage();
  page.on('console', (message) => console.error(`[page:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => console.error(`[page:error] ${error.stack ?? error.message}`));
  await page.evaluateOnNewDocument(() => {
    window.__nightfallBenchmark = { longTasks: 0, cls: 0 };
    new PerformanceObserver((list) => {
      window.__nightfallBenchmark.longTasks += list.getEntries().length;
    }).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__nightfallBenchmark.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle0' });
  try {
    await page.waitForSelector('html[data-nightfall="active"]', { timeout: 5_000 });
  } catch (error) {
    const diagnostic = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const results = [];
      for (const tab of tabs) {
        try {
          results.push({ tab: tab.url, response: await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }) });
        } catch (messageError) {
          results.push({ tab: tab.url, error: String(messageError) });
        }
      }
      return results;
    });
    throw new Error(`Content script did not become active: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
  await page.waitForSelector('.modal');
  await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  await page.hover('.dropdown-toggle');
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.dropdown-menu')).visibility === 'visible',
  );

  const pageMetrics = await page.evaluate(() => {
    const parse = (value) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
      return parts.slice(0, 3);
    };
    const luminance = (color) => {
      const channel = (value) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
    };
    const contrast = (a, b) => {
      const first = luminance(a);
      const second = luminance(b);
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    };
    const visibleText = [...document.querySelectorAll('h1, p, button, .modal')];
    const contrastViolations = visibleText.filter((element) => {
      const style = getComputedStyle(element);
      const background = parse(style.backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(element.parentElement).backgroundColor : style.backgroundColor);
      return contrast(parse(style.color), background) < 4.5;
    }).length;
    const paint = performance.getEntriesByType('paint').find((entry) => entry.name === 'first-contentful-paint');
    return {
      firstContentfulPaintMs: paint?.startTime ?? null,
      rootLuminance: luminance(parse(getComputedStyle(document.documentElement).backgroundColor)),
      modalLuminance: luminance(parse(getComputedStyle(document.querySelector('.modal')).backgroundColor)),
      dropdownLuminance: luminance(parse(getComputedStyle(document.querySelector('.dropdown-menu')).backgroundColor)),
      dropdownVisible: getComputedStyle(document.querySelector('.dropdown-menu')).visibility === 'visible',
      imageFilter: getComputedStyle(document.querySelector('img')).filter,
      contrastViolations,
      longTasks: window.__nightfallBenchmark.longTasks,
      cumulativeLayoutShift: window.__nightfallBenchmark.cls,
      buttonUsable: !document.querySelector('button').disabled,
    };
  });

  const extensionStatus = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
  });

  const fixtureTabId = await worker.evaluate(async (fixtureUrl) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url?.startsWith(fixtureUrl))?.id;
  }, `http://127.0.0.1:${port}`);
  const extensionId = new URL(workerTarget.url()).hostname;
  const popup = await browser.newPage();
  await popup.goto(
    `chrome-extension://${extensionId}/popup.html?tab=${fixtureTabId}`,
    { waitUntil: 'networkidle0' },
  );
  await popup.waitForSelector('[data-mode="slate-blue"][aria-pressed="true"]');
  const popupMetrics = await popup.evaluate(() => ({
    modeButtons: document.querySelectorAll('[data-mode]').length,
    permissionPromptVisible: Boolean(document.querySelector('#grant-access')),
  }));
  await popup.click('[data-mode="linear-dark"]');
  await page.waitForFunction(
    () => document.documentElement.dataset.nightfallTheme === 'linear-dark',
    { polling: 100, timeout: 5_000 },
  );
  const transitionStart = await page.evaluate(() => ({
    theme: document.documentElement.dataset.nightfallTheme,
    background: getComputedStyle(document.documentElement).backgroundColor,
  }));
  await new Promise((resolveWait) => setTimeout(resolveWait, 220));
  const settledModeChange = await page.evaluate(() => ({
    theme: document.documentElement.dataset.nightfallTheme,
    background: getComputedStyle(document.documentElement).backgroundColor,
  }));

  await page.evaluate(() => {
    history.pushState({}, '', '/menu/settings');
    document.querySelector('.card').classList.add('dark-route');
    const shell = document.createElement('div');
    shell.className = 'route-shell';
    shell.innerHTML = '<div class="route-panel">Nested SPA route content</div>';
    document.querySelector('main').append(shell);
  });
  try {
    await page.waitForFunction(
      () =>
        location.pathname === '/menu/settings' &&
        document.querySelector('.card')?.classList.contains('nightfall-adapted') &&
        document.querySelector('.route-panel')?.classList.contains('nightfall-adapted'),
      { polling: 100, timeout: 5_000 },
    );
  } catch (error) {
    const spaDiagnostic = await page.evaluate(() => ({
      url: location.href,
      rootTheme: document.documentElement.dataset.nightfallTheme,
      rootActive: document.documentElement.dataset.nightfall,
      cardClass: document.querySelector('.card')?.className,
      cardBackground: getComputedStyle(document.querySelector('.card')).backgroundColor,
      panelClass: document.querySelector('.route-panel')?.className,
      panelBackground: getComputedStyle(document.querySelector('.route-panel')).backgroundColor,
    }));
    spaDiagnostic.extensionStatus = await worker.evaluate(async (tabId) =>
      chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' }),
    fixtureTabId);
    throw new Error(`SPA mutation was not adapted: ${JSON.stringify(spaDiagnostic)}`, {
      cause: error,
    });
  }
  await page.waitForFunction(
    () => !document.documentElement.dataset.nightfallTransition,
    { polling: 100, timeout: 5_000 },
  );
  const spaMutation = await page.evaluate(() => ({
    cardBackground: getComputedStyle(document.querySelector('.card')).backgroundColor,
    nestedBackground: getComputedStyle(document.querySelector('.route-panel')).backgroundColor,
    theme: document.documentElement.dataset.nightfallTheme,
  }));

  await page.evaluate(() => {
    location.hash = 'details';
  });
  await page.waitForFunction(
    () => location.hash === '#details' && document.documentElement.dataset.nightfallTheme === 'linear-dark',
    { polling: 100, timeout: 5_000 },
  );
  await page.evaluate(() => history.back());
  await page.waitForFunction(
    () => location.hash === '' && document.documentElement.dataset.nightfallTheme === 'linear-dark',
    { polling: 100, timeout: 5_000 },
  );
  await page.evaluate(() => history.forward());
  await page.waitForFunction(
    () => location.hash === '#details' && document.documentElement.dataset.nightfallTheme === 'linear-dark',
    { polling: 100, timeout: 5_000 },
  );
  const historyNavigation = await page.evaluate(() => ({
    path: location.pathname,
    hash: location.hash,
    theme: document.documentElement.dataset.nightfallTheme,
  }));

  await popup.click('[data-mode="github-dark"]');
  await page.waitForFunction(
    () => document.documentElement.dataset.nightfallTheme === 'github-dark',
    { polling: 100, timeout: 5_000 },
  );
  const githubModeChange = await page.evaluate(() => ({
    active: document.documentElement.dataset.nightfall ?? null,
    theme: document.documentElement.dataset.nightfallTheme ?? null,
    cardBackground: getComputedStyle(document.querySelector('.card')).backgroundColor,
  }));
  githubModeChange.selectedMode = await popup.evaluate(
    () => document.querySelector('[data-mode][aria-pressed="true"]')?.dataset.mode ?? null,
  );
  githubModeChange.storedMode = await worker.evaluate(async () =>
    (await chrome.storage.local.get('nightfallSettings')).nightfallSettings?.mode ?? null,
  );

  await popup.evaluate(() => {
    document.querySelector('[data-mode="linear-dark"]').click();
    document.querySelector('[data-mode="github-dark"]').click();
    document.querySelector('[data-mode="slate-blue"]').click();
  });
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.nightfallTheme === 'slate-blue' &&
      document.querySelector('.card')?.classList.contains('nightfall-adapted'),
    { polling: 100, timeout: 5_000 },
  );
  await popup.waitForSelector('[data-mode="slate-blue"][aria-pressed="true"]');
  await worker.evaluate(async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const stored = (await chrome.storage.local.get('nightfallSettings')).nightfallSettings;
      if (stored?.mode === 'slate-blue') return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('Rapid mode changes did not persist the final selection');
  });
  const rapidModeChange = await page.evaluate(() => ({
    theme: document.documentElement.dataset.nightfallTheme,
    cardBackground: getComputedStyle(document.querySelector('.card')).backgroundColor,
  }));

  await popup.evaluate(async (tabId) => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        chrome.runtime.sendMessage({ type: 'ENSURE_CONTENT_SCRIPT', tabId }),
      ),
    );
  }, fixtureTabId);
  const registrationState = await worker.evaluate(async () => {
    const scripts = await chrome.scripting.getRegisteredContentScripts({
      ids: ['nightfall-engine'],
    });
    return { registeredScripts: scripts.length };
  });

  await worker.evaluate(() =>
    chrome.scripting.unregisterContentScripts({ ids: ['nightfall-engine'] }),
  );
  const alreadyOpenPage = await browser.newPage();
  await alreadyOpenPage.goto(`http://127.0.0.1:${port}/already-open`, {
    waitUntil: 'networkidle0',
  });
  const alreadyOpenTabId = await worker.evaluate(async (fixtureUrl) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url === fixtureUrl)?.id;
  }, `http://127.0.0.1:${port}/already-open`);
  await worker.evaluate(async (tabId) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['/stale-content.js'],
    });
  }, alreadyOpenTabId);
  const beforeEnsure = await alreadyOpenPage.evaluate(
    () => document.documentElement.dataset.nightfall ?? null,
  );
  const ensurePopup = await browser.newPage();
  await ensurePopup.goto(
    `chrome-extension://${extensionId}/popup.html?tab=${alreadyOpenTabId}`,
    { waitUntil: 'networkidle0' },
  );
  await alreadyOpenPage.waitForSelector('html[data-nightfall-theme="slate-blue"]', {
    timeout: 5_000,
  });
  const alreadyOpenRecovery = await alreadyOpenPage.evaluate((initialState) => ({
    beforeEnsure: initialState,
    active: document.documentElement.dataset.nightfall ?? null,
    theme: document.documentElement.dataset.nightfallTheme ?? null,
    styleCount: document.querySelectorAll('#nightfall-styles').length,
  }), beforeEnsure);
  await ensurePopup.close();
  await alreadyOpenPage.close();
  await popup.evaluate(async (tabId) => {
    await chrome.runtime.sendMessage({ type: 'ENSURE_CONTENT_SCRIPT', tabId });
  }, fixtureTabId);

  await page.goto(`http://127.0.0.1:${port}/full-navigation`, {
    waitUntil: 'networkidle0',
  });
  await page.waitForSelector('html[data-nightfall-theme="slate-blue"]', {
    timeout: 5_000,
  });
  const fullNavigation = await page.evaluate(() => ({
    path: location.pathname,
    theme: document.documentElement.dataset.nightfallTheme,
    styleCount: document.querySelectorAll('#nightfall-styles').length,
  }));

  const pickerPopup = await browser.newPage();
  await pickerPopup.goto(
    `chrome-extension://${extensionId}/popup.html?tab=${fixtureTabId}`,
    { waitUntil: 'networkidle0' },
  );
  await pickerPopup.waitForSelector('#inspect-element:not([disabled])');
  await pickerPopup.evaluate(() => document.querySelector('#inspect-element').click());
  await page.waitForSelector('#nightfall-element-picker');
  const cardPoint = await page.evaluate(() => {
    const rect = document.querySelector('.card').getBoundingClientRect();
    return { x: rect.left + rect.width - 12, y: rect.top + rect.height - 12 };
  });
  await page.mouse.move(cardPoint.x, cardPoint.y);
  await page.mouse.click(cardPoint.x, cardPoint.y);
  await page.waitForFunction(
    () => document.querySelectorAll('[data-nightfall-repair="true"]').length === 1,
    { polling: 100, timeout: 5_000 },
  );
  const savedElementFix = await worker.evaluate(async () => {
    const stored = (await chrome.storage.local.get('nightfallSettings')).nightfallSettings;
    const repairs = stored?.sites?.['127.0.0.1']?.repairs ?? [];
    return { count: repairs.length, path: repairs[0]?.path, selector: repairs[0]?.selector };
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-nightfall-repair="true"]', { timeout: 5_000 });
  const persistedElementFix = await page.evaluate(() => ({
    path: location.pathname,
    repairedCount: document.querySelectorAll('[data-nightfall-repair="true"]').length,
  }));

  const clearPopup = await browser.newPage();
  await clearPopup.goto(
    `chrome-extension://${extensionId}/popup.html?tab=${fixtureTabId}`,
    { waitUntil: 'networkidle0' },
  );
  await clearPopup.waitForSelector('#clear-fixes');
  await clearPopup.click('#clear-fixes');
  await page.waitForFunction(
    () => document.querySelectorAll('[data-nightfall-repair]').length === 0,
    { polling: 100, timeout: 5_000 },
  );
  const clearedElementFix = await worker.evaluate(async () => {
    const stored = (await chrome.storage.local.get('nightfallSettings')).nightfallSettings;
    return stored?.sites?.['127.0.0.1']?.repairs?.length ?? 0;
  });
  await clearPopup.close();

  const resetPopup = await browser.newPage();
  await resetPopup.goto(
    `chrome-extension://${extensionId}/popup.html?tab=${fixtureTabId}`,
    { waitUntil: 'networkidle0' },
  );
  await resetPopup.waitForSelector('[data-mode="slate-blue"][aria-pressed="true"]');
  await resetPopup.click('[data-mode="original"]');
  await page.waitForFunction(
    () => document.documentElement.dataset.nightfall !== 'active',
    { polling: 100, timeout: 5_000 },
  );
  const originalReset = await page.evaluate(() => ({
    active: document.documentElement.dataset.nightfall ?? null,
    theme: document.documentElement.dataset.nightfallTheme ?? null,
    styleCount: document.querySelectorAll('#nightfall-styles').length,
    adaptedCount: document.querySelectorAll('.nightfall-adapted').length,
    inlineVariableCount: [...document.querySelectorAll('[style]')].filter((element) =>
      [...element.style].some((property) => property.startsWith('--nightfall-')),
    ).length,
    background: getComputedStyle(document.documentElement).backgroundColor,
  }));
  originalReset.selectedMode = await resetPopup.evaluate(
    () => document.querySelector('[data-mode][aria-pressed="true"]')?.dataset.mode ?? null,
  );
  originalReset.storedSettings = await worker.evaluate(async () =>
    (await chrome.storage.local.get('nightfallSettings')).nightfallSettings ?? null,
  );
  await resetPopup.close();

  const report = {
    browser: await browser.version(),
    ...pageMetrics,
    extension: extensionStatus.status,
    popup: popupMetrics,
    immediateModeChange: {
      theme: transitionStart.theme,
      transitionStartBackground: transitionStart.background,
      settledBackground: settledModeChange.background,
    },
    spaMutation,
    historyNavigation,
    githubModeChange,
    rapidModeChange,
    registrationState,
    alreadyOpenRecovery,
    fullNavigation,
    savedElementFix,
    persistedElementFix,
    clearedElementFix,
    originalReset,
  };
  console.log(JSON.stringify(report, null, 2));

  const failed =
    pageMetrics.rootLuminance > 0.15 ||
    pageMetrics.modalLuminance > 0.15 ||
    pageMetrics.dropdownLuminance > 0.15 ||
    !pageMetrics.dropdownVisible ||
    pageMetrics.imageFilter !== 'none' ||
    pageMetrics.contrastViolations > 0 ||
    !pageMetrics.buttonUsable ||
    popupMetrics.modeButtons !== 4 ||
    transitionStart.theme !== 'linear-dark' ||
    transitionStart.background === 'rgb(255, 255, 255)' ||
    settledModeChange.theme !== 'linear-dark' ||
    settledModeChange.background !== 'rgb(16, 16, 16)' ||
    spaMutation.theme !== 'linear-dark' ||
    spaMutation.cardBackground === 'rgb(8, 10, 14)' ||
    spaMutation.nestedBackground === 'rgb(247, 248, 250)' ||
    historyNavigation.path !== '/menu/settings' ||
    historyNavigation.hash !== '#details' ||
    historyNavigation.theme !== 'linear-dark' ||
    githubModeChange.active !== 'active' ||
    githubModeChange.theme !== 'github-dark' ||
    githubModeChange.selectedMode !== 'github-dark' ||
    githubModeChange.storedMode !== 'github-dark' ||
    rapidModeChange.theme !== 'slate-blue' ||
    rapidModeChange.cardBackground === 'rgb(8, 10, 14)' ||
    registrationState.registeredScripts !== 1 ||
    alreadyOpenRecovery.beforeEnsure !== null ||
    alreadyOpenRecovery.active !== 'active' ||
    alreadyOpenRecovery.theme !== 'slate-blue' ||
    alreadyOpenRecovery.styleCount !== 1 ||
    fullNavigation.path !== '/full-navigation' ||
    fullNavigation.theme !== 'slate-blue' ||
    fullNavigation.styleCount !== 1 ||
    savedElementFix.count !== 1 ||
    savedElementFix.path !== '/full-navigation' ||
    !savedElementFix.selector ||
    persistedElementFix.path !== '/full-navigation' ||
    persistedElementFix.repairedCount !== 1 ||
    clearedElementFix !== 0 ||
    originalReset.active !== null ||
    originalReset.theme !== null ||
    originalReset.styleCount !== 0 ||
    originalReset.adaptedCount !== 0 ||
    originalReset.inlineVariableCount !== 0 ||
    originalReset.background !== 'rgb(255, 255, 255)' ||
    originalReset.selectedMode !== 'original' ||
    originalReset.storedSettings?.mode !== 'original' ||
    originalReset.storedSettings?.sites?.['127.0.0.1']?.mode !== 'original' ||
    popupMetrics.permissionPromptVisible;
  if (failed) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
  rmSync(testRoot, { recursive: true, force: true });
}

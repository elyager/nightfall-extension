import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
      .overlay-fixture { position: relative; width: 160px; height: 90px; margin-top: 16px; }
      .overlay-fixture img { width: 100%; height: 100%; margin-top: 0; }
      .overlay-fixture-layer { position: absolute; inset: 0; background: #fff; }
      .modal { position: fixed; inset: 20% 25%; padding: 30px; background: #fff; color: #111; }
      .algorithm-probes { display: grid; grid-template-columns: repeat(2, 250px); gap: 12px; margin-top: 18px; }
      .algorithm-probes > * { padding: 12px; border: 1px solid #ddd; }
      #purple-panel { background: #c084fc; color: #220a38; }
      #dark-accent { background: #6d28d9; color: #fff; }
      #bright-accent { background: #ffd600; color: #fff; }
      #class-probe { background: #f8f8f8; color: #222; }
      #class-probe.purple-state { background: #c084fc; color: #220a38; }
      #media-filters { display: flex; gap: 8px; margin-top: 12px; }
      #media-filters > * { width: 48px; height: 32px; }
    </style>
  </head>
  <body>
    <main><div class="card"><h1>Benchmark page</h1><p>Readable ordinary text.</p><button id="action">Action</button><div class="dropdown"><button class="dropdown-toggle">Menu</button><div class="dropdown-menu"><a class="dropdown-item" href="#item">Dropdown item</a></div></div><img alt="Protected media" style="filter: contrast(1.1)" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'%3E%3Crect width='160' height='90' fill='%23e85d75'/%3E%3Ccircle cx='80' cy='45' r='28' fill='%23456fe8'/%3E%3C/svg%3E"><div class="overlay-fixture" data-dram-node-role="PainterContentContainer"><img alt="Overlay media" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'%3E%3Crect width='160' height='90' fill='%23e85d75'/%3E%3Ccircle cx='80' cy='45' r='28' fill='%23456fe8'/%3E%3C/svg%3E"><div id="image-overlay-layer" class="overlay-fixture-layer">Image layer</div></div></div></main>
    <section class="algorithm-probes">
      <div id="purple-panel">Purple surface</div>
      <button id="dark-accent">Dark purple accent</button>
      <button id="bright-accent">Bright yellow accent</button>
      <div id="alpha-probe" style="background-color: rgba(221, 191, 255, 0.45); color: rgba(30, 10, 55, 0.8)">Transparent surface and text</div>
      <div id="image-background" style="background-image: linear-gradient(90deg, rgb(20, 30, 40), rgb(70, 80, 90)); color: white">Background image text</div>
      <div id="inline-probe" style="background-color: rgb(250, 245, 255) !important; color: rgb(24, 12, 36) !important; border: 2px solid rgb(180, 160, 200); padding: 7px">Authored inline styles</div>
      <div id="class-probe">Dynamic class</div>
      <div id="style-probe" style="background-color: rgb(250, 250, 250); color: rgb(25, 25, 25)">Dynamic inline style</div>
      <div id="hidden-probe" hidden style="background-color: rgb(248, 248, 248); color: rgb(20, 20, 20)">Revealed content</div>
      <div id="modern-surface" style="background-color: oklch(80% 0.12 300); color: oklch(22% 0.08 300)">Modern CSS color surface</div>
      <button id="modern-accent" style="background-color: oklch(38% 0.15 300); color: oklch(96% 0.01 300)">Modern CSS light text</button>
    </section>
    <div id="media-filters"><video style="filter: saturate(0.8)"></video><canvas style="filter: opacity(0.7)"></canvas><svg style="filter: contrast(0.9)" viewBox="0 0 48 32"><rect width="48" height="32" fill="#59a7f2"/></svg></div>
    <script>setTimeout(() => { const modal = document.createElement('div'); modal.className = 'modal'; modal.textContent = 'SPA navigation content'; document.body.append(modal); }, 250);</script>
  </body>
</html>`;

// Evaluated in Chrome so contrast and alpha use actual computed, composited colors.
function readFixtureAppearance() {
  const parse = (value) => {
    if (!value.startsWith('rgb')) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return { rgb: [r, g, b], alpha: a / 255 };
    }
    const channels = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1 };
  };
  const luminance = (rgb) => rgb.reduce((total, value, index) => {
    const channel = value / 255;
    return total + [0.2126, 0.7152, 0.0722][index] * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  }, 0);
  const composite = (front, back) => front.rgb.map((channel, index) => channel * front.alpha + back[index] * (1 - front.alpha));
  const background = (element) => {
    if (!element) return [255, 255, 255];
    const color = parse(getComputedStyle(element).backgroundColor);
    return color.alpha === 1 ? color.rgb : composite(color, background(element.parentElement));
  };
  const hue = (rgb) => {
    const [r, g, b] = rgb.map((value) => value / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    if (delta === 0) return null;
    return ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
  };
  const probe = (selector) => {
    const element = document.querySelector(selector), style = getComputedStyle(element);
    const fg = parse(style.color), bg = parse(style.backgroundColor), effective = background(element);
    const foregroundLuminance = luminance(composite(fg, effective)), backgroundLuminance = luminance(effective);
    return {
      background: style.backgroundColor, foreground: style.color,
      backgroundAlpha: bg.alpha, foregroundAlpha: fg.alpha,
      hue: hue(bg.rgb), backgroundLuminance, foregroundLuminance,
      contrast: (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
    };
  };
  return {
    purple: probe('#purple-panel'), darkAccent: probe('#dark-accent'), brightAccent: probe('#bright-accent'),
    alpha: probe('#alpha-probe'), inline: probe('#inline-probe'),
    classProbe: probe('#class-probe'), styleProbe: probe('#style-probe'), hiddenProbe: probe('#hidden-probe'),
    modernSurface: probe('#modern-surface'), modernAccent: probe('#modern-accent'),
    backgroundImage: getComputedStyle(document.querySelector('#image-background')).backgroundImage,
    mediaFilters: [...document.querySelectorAll('#media-filters > *')].map((element) => getComputedStyle(element).filter),
    inlineProperties: Object.fromEntries(['background-color', 'color', 'border-top-width', 'padding'].map((property) => [property, {
      value: document.querySelector('#inline-probe').style.getPropertyValue(property),
      priority: document.querySelector('#inline-probe').style.getPropertyPriority(property),
    }])),
  };
}

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
  const workerDevtools = await workerTarget.createCDPSession();
  const aiRequests = [];
  await workerDevtools.send('Network.enable');
  workerDevtools.on('Network.requestWillBeSent', ({ request }) => {
    if (new URL(request.url).hostname === 'openrouter.ai') aiRequests.push(request.url);
  });
  const loadedManifest = await worker.evaluate(() => chrome.runtime.getManifest());
  if (loadedManifest.name !== 'Nightfall') {
    throw new Error(`Unexpected extension loaded: ${loadedManifest.name}`);
  }
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      nightfallSettings: {
        revision: 0,
        mode: 'dark',
        imageBrightness: 100,
        sites: {
          '127.0.0.1': {
            enabled: true, mode: 'dark', repairs: [],
            aiTheme: {
              id: 'ai', label: 'AI', pageBackground: '#14121C', surface: '#1B1826', elevatedSurface: '#241F33',
              textPrimary: '#F2F2F2', textSecondary: '#CCCCCC', textMuted: '#AAAAAA', textDisabled: '#777777',
              border: '#443C55', borderSubtle: '#312B40', link: '#D1B3FF', linkHover: '#E8D8FF', linkVisited: '#DBBEF9',
              controlBackground: '#221D30', controlHover: '#4D3C65', controlActive: '#604A7E', controlDisabled: '#191620',
              focusRing: '#D1B3FF', selectionBackground: '#493362', selectionText: '#FFFFFF',
              scrollbarTrack: '#14121C', scrollbarThumb: '#443C55', scrollbarThumbHover: '#605375',
              shadow: 'rgba(0, 0, 0, 0.48)', neutralBlend: 0.84,
            },
          },
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
  const dropdownVisibleBeforeItemHover = await page.evaluate(
    () => getComputedStyle(document.querySelector('.dropdown-menu')).visibility === 'visible',
  );
  const devtools = await page.createCDPSession();
  await devtools.send('DOM.enable');
  await devtools.send('CSS.enable');
  const { root: documentNode } = await devtools.send('DOM.getDocument');
  const { nodeId: dropdownItemNodeId } = await devtools.send('DOM.querySelector', {
    nodeId: documentNode.nodeId,
    selector: '.dropdown-item',
  });
  await devtools.send('CSS.forcePseudoState', {
    nodeId: dropdownItemNodeId,
    forcedPseudoClasses: ['hover'],
  });

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
    const dropdown = getComputedStyle(document.querySelector('.dropdown-menu'));
    const dropdownItem = getComputedStyle(document.querySelector('.dropdown-item'));
    const dropdownBackground = parse(dropdown.backgroundColor);
    const dropdownItemBackground = parse(dropdownItem.backgroundColor);
    const imageOverlay = document.querySelector('#image-overlay-layer');
    const imageOverlayStyle = getComputedStyle(imageOverlay);
    return {
      firstContentfulPaintMs: paint?.startTime ?? null,
      rootLuminance: luminance(parse(getComputedStyle(document.documentElement).backgroundColor)),
      modalLuminance: luminance(parse(getComputedStyle(document.querySelector('.modal')).backgroundColor)),
      dropdownLuminance: luminance(dropdownBackground),
      dropdownHoverSurfaceContrast: contrast(dropdownItemBackground, dropdownBackground),
      dropdownHoverTextContrast: contrast(parse(dropdownItem.color), dropdownItemBackground),
      imageFilter: getComputedStyle(document.querySelector('img')).filter,
      imageOverlay: {
        background: imageOverlayStyle.backgroundColor,
        transparent: imageOverlayStyle.backgroundColor === 'rgba(0, 0, 0, 0)',
        adapted: imageOverlay.classList.contains('nightfall-adapted-background'),
        nightfallColor: imageOverlay.style.getPropertyValue('--nightfall-element-bg'),
      },
      contrastViolations,
      longTasks: window.__nightfallBenchmark.longTasks,
      cumulativeLayoutShift: window.__nightfallBenchmark.cls,
      buttonUsable: !document.querySelector('button').disabled,
    };
  });
  pageMetrics.dropdownVisible = dropdownVisibleBeforeItemHover;
  const algorithm = await page.evaluate(readFixtureAppearance);

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
  await popup.waitForSelector('[data-mode="dark"][aria-pressed="true"]');
  const popupMetrics = await popup.evaluate(() => ({
    modeButtons: document.querySelectorAll('[data-mode]').length,
    permissionPromptVisible: Boolean(document.querySelector('#grant-access')),
  }));
  await popup.$eval('#image-brightness', (input) => {
    input.value = '70';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('img')).filter.includes('brightness(0.7)'),
    { polling: 100, timeout: 5_000 },
  );
  const imageBrightness = {
    filter: await page.$eval('img', (image) => getComputedStyle(image).filter),
    stored: await worker.evaluate(async () =>
      (await chrome.storage.local.get('nightfallSettings')).nightfallSettings?.imageBrightness ?? null,
    ),
  };
  await popup.click('[data-mode="original"]');
  await page.waitForFunction(() => !document.documentElement.dataset.nightfall, { timeout: 5_000 });
  const initialOriginal = await page.evaluate(readFixtureAppearance);
  await popup.waitForSelector('[data-mode="original"][aria-pressed="true"]');
  await popup.click('[data-mode="dark"]');
  await page.waitForSelector('html[data-nightfall-theme="dark"]', { timeout: 5_000 });
  await page.waitForFunction(() => !document.documentElement.dataset.nightfallTransition, { timeout: 5_000 });
  const originalToDark = {
    originalInlineBackground: initialOriginal.inline.background,
    originalMediaFilters: initialOriginal.mediaFilters,
    restoredBackground: await page.$eval('html', (element) => getComputedStyle(element).backgroundColor),
  };

  const processedBeforeAttributeChurn = await worker.evaluate(async (tabId) =>
    (await chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' })).status.processedNodes,
  fixtureTabId);
  await page.bringToFront();
  await page.evaluate(async () => {
    const card = document.querySelector('.card');
    for (let index = 0; index < 12; index += 1) {
      card.classList.toggle('animated-state');
      await new Promise(requestAnimationFrame);
    }
    card.classList.remove('animated-state');
  });
  await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  const processedAfterAttributeChurn = await worker.evaluate(async (tabId) =>
    (await chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' })).status.processedNodes,
  fixtureTabId);
  await new Promise((resolveWait) => setTimeout(resolveWait, 350));
  const attributeMutation = await worker.evaluate(async (tabId, before, after) => {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' });
    return { reprocessedNodes: after - before, idleReprocessedNodes: response.status.processedNodes - after };
  }, fixtureTabId, processedBeforeAttributeChurn, processedAfterAttributeChurn);

  const beforeDynamic = await page.evaluate(readFixtureAppearance);
  await page.evaluate(() => {
    document.querySelector('#class-probe').classList.add('purple-state');
    document.querySelector('#style-probe').style.backgroundColor = 'rgb(192, 132, 252)';
    document.querySelector('#style-probe').style.color = 'rgb(34, 10, 56)';
    document.querySelector('#hidden-probe').hidden = false;
  });
  await page.waitForFunction((previousBackground) => {
    const classProbe = document.querySelector('#class-probe');
    const styleProbe = document.querySelector('#style-probe');
    const hiddenProbe = document.querySelector('#hidden-probe');
    return getComputedStyle(classProbe).backgroundColor !== previousBackground &&
      getComputedStyle(styleProbe).backgroundColor !== 'rgb(192, 132, 252)' &&
      hiddenProbe.classList.contains('nightfall-adapted');
  }, { polling: 100, timeout: 5_000 }, beforeDynamic.classProbe.background);
  const dynamicMutation = await page.evaluate(readFixtureAppearance);

  await page.evaluate(() => {
    document.querySelector('#nightfall-styles').dataset.navigationToken = 'preserved';
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
    stylePreserved:
      document.querySelector('#nightfall-styles')?.dataset.navigationToken === 'preserved',
    pendingRoots: document.querySelectorAll('[data-nightfall-pending]').length,
    bodyOpacity: getComputedStyle(document.body).opacity,
  }));

  await page.evaluate(() => {
    location.hash = 'details';
  });
  await page.waitForFunction(
    () => location.hash === '#details' && document.documentElement.dataset.nightfallTheme === 'dark',
    { polling: 100, timeout: 5_000 },
  );
  await page.evaluate(() => history.back());
  await page.waitForFunction(
    () => location.hash === '' && document.documentElement.dataset.nightfallTheme === 'dark',
    { polling: 100, timeout: 5_000 },
  );
  await page.evaluate(() => history.forward());
  await page.waitForFunction(
    () => location.hash === '#details' && document.documentElement.dataset.nightfallTheme === 'dark',
    { polling: 100, timeout: 5_000 },
  );
  const historyNavigation = await page.evaluate(() => ({
    path: location.pathname,
    hash: location.hash,
    theme: document.documentElement.dataset.nightfallTheme,
  }));

  await popup.bringToFront();
  await popup.click('[data-mode="ai"]');
  await page.waitForSelector('html[data-nightfall-theme="ai"]', { timeout: 5_000 });
  const aiRenderingSettled = await page.waitForFunction(() => {
    const [r, g, b] = getComputedStyle(document.documentElement).backgroundColor.match(/[\d.]+/g).map(Number);
    return r > g && b > r && Math.max(r, g, b) < 90;
  }, { polling: 100, timeout: 5_000 }).then(() => true).catch(() => false);
  const cachedAi = {
    theme: await page.$eval('html', (element) => element.dataset.nightfallTheme),
    background: await page.$eval('html', (element) => getComputedStyle(element).backgroundColor),
    selectedMode: await popup.$eval('[data-mode][aria-pressed="true"]', (element) => element.dataset.mode),
    renderingSettled: aiRenderingSettled,
    diagnostic: await page.evaluate(() => ({
      rootStyle: document.documentElement.getAttribute('style'),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      paletteCss: document.querySelector('#nightfall-styles')?.textContent.slice(0, 220),
    })),
    status: await worker.evaluate(async (tabId) => chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' }), fixtureTabId),
  };
  if (!aiRenderingSettled) console.error('[AI render diagnostic]', JSON.stringify(cachedAi));
  await popup.click('[data-mode="dark"]');
  await page.waitForSelector('html[data-nightfall-theme="dark"]', { timeout: 5_000 });
  const darkRenderingSettled = await page.waitForFunction(() => getComputedStyle(document.documentElement).backgroundColor === 'rgb(16, 16, 16)', { polling: 100, timeout: 5_000 })
    .then(() => true).catch(() => false);
  const cachedAiToDark = {
    ai: cachedAi,
    renderingSettled: darkRenderingSettled,
    darkBackground: await page.$eval('html', (element) => getComputedStyle(element).backgroundColor),
    storedMode: await worker.evaluate(async () => (await chrome.storage.local.get('nightfallSettings')).nightfallSettings.mode),
  };

  await popup.evaluate(() => {
    document.querySelector('[data-mode="original"]').click();
    document.querySelector('[data-mode="ai"]').click();
    document.querySelector('[data-mode="dark"]').click();
  });
  await page.waitForFunction(
    () => document.documentElement.dataset.nightfallTheme === 'dark' && document.querySelector('.card')?.classList.contains('nightfall-adapted'),
    { polling: 100, timeout: 5_000 },
  );
  await popup.waitForSelector('[data-mode="dark"][aria-pressed="true"]');
  await worker.evaluate(async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if ((await chrome.storage.local.get('nightfallSettings')).nightfallSettings?.mode === 'dark') return;
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
  await alreadyOpenPage.waitForSelector('html[data-nightfall-theme="dark"]', {
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
  await page.waitForSelector('html[data-nightfall-theme="dark"]', {
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
  await page.bringToFront();
  const cardPoint = await page.evaluate(() => {
    const rect = document.querySelector('.card > h1').getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.move(cardPoint.x, cardPoint.y);
  await page.keyboard.press('ArrowUp');
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
  await resetPopup.waitForSelector('[data-mode="dark"][aria-pressed="true"]');
  const screenshotDirectory = resolve('output/browser-check');
  mkdirSync(screenshotDirectory, { recursive: true });
  await resetPopup.setViewport({ width: 344, height: 820 });
  await (await resetPopup.$('#app')).screenshot({ path: join(screenshotDirectory, 'popup.png') });
  await page.evaluate(() => document.querySelector('.modal')?.remove());
  await page.setViewport({ width: 1100, height: 850 });
  await page.screenshot({ path: join(screenshotDirectory, 'dark-fixture.png'), fullPage: true });
  await page.evaluate(() => {
    const subtree = document.createElement('section');
    subtree.id = 'pending-at-disable';
    for (let index = 0; index < 240; index += 1) {
      const child = document.createElement('div');
      child.style.backgroundColor = 'white';
      child.textContent = 'Queued content';
      subtree.append(child);
    }
    document.body.append(subtree);
  });
  await resetPopup.click('[data-mode="original"]');
  await page.waitForFunction(
    () => document.documentElement.dataset.nightfall !== 'active',
    { polling: 100, timeout: 5_000 },
  );
  await page.evaluate(() => {
    document.querySelector('#class-probe').classList.add('purple-state');
    document.querySelector('#style-probe').style.backgroundColor = 'rgb(192, 132, 252)';
    document.querySelector('#hidden-probe').hidden = false;
  });
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  const originalReset = await page.evaluate(() => ({
    active: document.documentElement.dataset.nightfall ?? null,
    theme: document.documentElement.dataset.nightfallTheme ?? null,
    styleCount: document.querySelectorAll('#nightfall-styles').length,
    adaptedCount: document.querySelectorAll('.nightfall-adapted').length,
    inlineVariableCount: [...document.querySelectorAll('[style]')].filter((element) =>
      [...element.style].some((property) => property.startsWith('--nightfall-')),
    ).length,
    imageOverlayCount: document.querySelectorAll('.nightfall-image-overlay').length,
    background: getComputedStyle(document.documentElement).backgroundColor,
  }));
  originalReset.selectedMode = await resetPopup.evaluate(
    () => document.querySelector('[data-mode][aria-pressed="true"]')?.dataset.mode ?? null,
  );
  originalReset.storedSettings = await worker.evaluate(async () =>
    (await chrome.storage.local.get('nightfallSettings')).nightfallSettings ?? null,
  );
  originalReset.appearance = await page.evaluate(readFixtureAppearance);
  await page.evaluate(() => document.querySelector('#pending-at-disable')?.remove());
  await page.screenshot({ path: join(screenshotDirectory, 'original-fixture.png'), fullPage: true });
  await resetPopup.close();

  const [aiRed, aiGreen, aiBlue] = cachedAiToDark.ai.background.match(/[\d.]+/g).map(Number);
  const assertions = {
    darkPage: pageMetrics.rootLuminance <= 0.15 && pageMetrics.modalLuminance <= 0.15,
    dropdownUsable: pageMetrics.dropdownVisible && pageMetrics.dropdownLuminance <= 0.15 &&
      pageMetrics.dropdownHoverSurfaceContrast >= 1.5 && pageMetrics.dropdownHoverTextContrast >= 4.5,
    readableText: pageMetrics.contrastViolations === 0 && pageMetrics.buttonUsable,
    imagePreserved: pageMetrics.imageFilter === 'contrast(1.1)' && pageMetrics.imageOverlay.transparent &&
      !pageMetrics.imageOverlay.adapted && pageMetrics.imageOverlay.nightfallColor === '',
    mediaFiltersPreserved: JSON.stringify(algorithm.mediaFilters) === JSON.stringify(['saturate(0.8)', 'opacity(0.7)', 'contrast(0.9)']),
    backgroundImagePreserved: algorithm.backgroundImage === initialOriginal.backgroundImage,
    purpleHuePreserved: algorithm.purple.hue > 260 && algorithm.purple.hue < 290 && algorithm.purple.backgroundLuminance < 0.15,
    darkAccentLightText: algorithm.darkAccent.contrast >= 4.5 && algorithm.darkAccent.foregroundLuminance > algorithm.darkAccent.backgroundLuminance,
    brightAccentDarkText: algorithm.brightAccent.contrast >= 4.5 && algorithm.brightAccent.foregroundLuminance < algorithm.brightAccent.backgroundLuminance,
    alphaPreserved: Math.abs(algorithm.alpha.backgroundAlpha - 0.45) < 0.005 && Math.abs(algorithm.alpha.foregroundAlpha - 0.8) < 0.005,
    alphaSurfaceAdapted: algorithm.alpha.backgroundLuminance < 0.15 && algorithm.alpha.contrast >= 4.5,
    inlineThemeAdapted: algorithm.inline.backgroundLuminance < 0.15 && algorithm.inline.contrast >= 4.5,
    modernColorSurface: algorithm.modernSurface.backgroundLuminance < 0.15 && algorithm.modernSurface.contrast >= 4.5,
    modernColorLightText: algorithm.modernAccent.contrast >= 4.5 && algorithm.modernAccent.foregroundLuminance > algorithm.modernAccent.backgroundLuminance,
    threeModes: popupMetrics.modeButtons === 3 && !popupMetrics.permissionPromptVisible,
    brightnessPreservesAuthoredFilter: imageBrightness.stored === 70 && imageBrightness.filter.includes('contrast(1.1)') && imageBrightness.filter.includes('brightness(0.7)'),
    originalToDark: originalToDark.originalInlineBackground === 'rgb(250, 245, 255)' &&
      originalToDark.restoredBackground === 'rgb(16, 16, 16)',
    mutationsSettle: attributeMutation.reprocessedNodes > 0 && attributeMutation.reprocessedNodes < 2000 && attributeMutation.idleReprocessedNodes === 0,
    classMutationAdapted: dynamicMutation.classProbe.hue > 260 && dynamicMutation.classProbe.hue < 290 && dynamicMutation.classProbe.backgroundLuminance < 0.15,
    styleMutationAdapted: dynamicMutation.styleProbe.hue > 260 && dynamicMutation.styleProbe.hue < 290 && dynamicMutation.styleProbe.backgroundLuminance < 0.15,
    hiddenMutationAdapted: dynamicMutation.hiddenProbe.backgroundLuminance < 0.15 && dynamicMutation.hiddenProbe.contrast >= 4.5,
    spaMutationAdapted: spaMutation.theme === 'dark' && spaMutation.nestedBackground !== 'rgb(247, 248, 250)' &&
      spaMutation.stylePreserved && spaMutation.pendingRoots === 0 && spaMutation.bodyOpacity !== '0',
    historyNavigation: historyNavigation.path === '/menu/settings' && historyNavigation.hash === '#details' && historyNavigation.theme === 'dark',
    cachedAiToDark: cachedAiToDark.ai.theme === 'ai' && cachedAiToDark.ai.selectedMode === 'ai' && cachedAiToDark.ai.renderingSettled && cachedAiToDark.renderingSettled &&
      aiRed > aiGreen && aiBlue > aiRed && Math.max(aiRed, aiGreen, aiBlue) < 90 &&
      cachedAiToDark.darkBackground === 'rgb(16, 16, 16)' && cachedAiToDark.storedMode === 'dark',
    noAiNetworkRequests: aiRequests.length === 0,
    rapidModeChange: rapidModeChange.theme === 'dark',
    oneRegistration: registrationState.registeredScripts === 1,
    alreadyOpenRecovery: alreadyOpenRecovery.beforeEnsure === null && alreadyOpenRecovery.active === 'active' &&
      alreadyOpenRecovery.theme === 'dark' && alreadyOpenRecovery.styleCount === 1,
    fullNavigation: fullNavigation.path === '/full-navigation' && fullNavigation.theme === 'dark' && fullNavigation.styleCount === 1,
    elementRepair: savedElementFix.count === 1 && savedElementFix.path === '/full-navigation' && savedElementFix.selector === 'div.card' &&
      persistedElementFix.path === '/full-navigation' && persistedElementFix.repairedCount === 1 && clearedElementFix === 0,
    originalRestored: originalReset.active === null && originalReset.theme === null && originalReset.styleCount === 0 &&
      originalReset.adaptedCount === 0 && originalReset.inlineVariableCount === 0 && originalReset.imageOverlayCount === 0 &&
      originalReset.background === 'rgb(255, 255, 255)' && originalReset.selectedMode === 'original' &&
      originalReset.storedSettings?.mode === 'original' && originalReset.storedSettings?.sites?.['127.0.0.1']?.mode === 'original',
    originalInlineRestored: JSON.stringify(originalReset.appearance.inlineProperties) === JSON.stringify(initialOriginal.inlineProperties) &&
      originalReset.appearance.inline.background === 'rgb(250, 245, 255)' && originalReset.appearance.inline.foreground === 'rgb(24, 12, 36)',
    originalMediaRestored: JSON.stringify(originalReset.appearance.mediaFilters) === JSON.stringify(initialOriginal.mediaFilters),
    disabledMutationUntouched: originalReset.appearance.classProbe.background === 'rgb(192, 132, 252)' && originalReset.appearance.styleProbe.background === 'rgb(192, 132, 252)',
  };
  const report = {
    browser: await browser.version(),
    ...pageMetrics,
    extension: extensionStatus.status,
    popup: popupMetrics,
    algorithm,
    imageBrightness,
    originalToDark,
    attributeMutation,
    dynamicMutation,
    spaMutation,
    historyNavigation,
    cachedAiToDark,
    rapidModeChange,
    registrationState,
    alreadyOpenRecovery,
    fullNavigation,
    savedElementFix,
    persistedElementFix,
    clearedElementFix,
    originalReset,
    assertions,
    failures: Object.entries(assertions).filter(([, passed]) => !passed).map(([name]) => name),
    screenshots: screenshotDirectory,
  };
  writeFileSync(join(screenshotDirectory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
  rmSync(testRoot, { recursive: true, force: true });
}

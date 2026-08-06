import './style.css';
import { createSerialTaskQueue } from '@/utils/async-queue';
import type {
  BackgroundMessage,
  BackgroundResponse,
  ContentResponse,
} from '@/utils/messages';
import { sitePermissionPattern } from '@/utils/permissions';
import { pagePath, repairsForPath } from '@/utils/repairs';
import {
  getSiteSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Mode,
  type NightfallSettings,
  type PerformanceStatus,
  updateSiteSettings,
} from '@/utils/settings';

const app = document.querySelector<HTMLElement>('#app')!;
const isDevMode = import.meta.env.DEV;
let settings: NightfallSettings = DEFAULT_SETTINGS;
let tabId: number | undefined;
let hostname = '';
let currentUrl = '';
let hasAccess = false;
let persistRevision = 0;
const enqueuePersist = createSerialTaskQueue();

app.innerHTML = '<p class="popup-loading" role="status">Loading Nightfall…</p>';

const modeOptions: Array<{ mode: Mode; label: string; title: string }> = [
  { mode: 'original', label: 'Original', title: 'Use the website’s default appearance' },
  { mode: 'slate-blue', label: 'Slate', title: 'Cooler colors for app-like interfaces' },
  { mode: 'linear-dark', label: 'Linear', title: 'Deep neutral blacks with cyan-blue accents' },
  { mode: 'github-dark', label: 'GitHub', title: 'Crisp charcoal surfaces with blue accents' },
];

async function getActiveTab() {
  const requestedTab = Number(new URLSearchParams(location.search).get('tab'));
  const tab = Number.isInteger(requestedTab) && requestedTab > 0
    ? await browser.tabs.get(requestedTab)
    : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
  tabId = tab?.id;
  currentUrl = tab?.url ?? '';
  try {
    hostname = currentUrl ? new URL(currentUrl).hostname : '';
  } catch {
    hostname = '';
  }

  const pattern = permissionPattern();
  hasAccess = pattern
    ? await browser.permissions.contains({ origins: [pattern] })
    : false;
}

function permissionPattern(): string | null {
  return sitePermissionPattern(currentUrl);
}

async function getStatus(): Promise<PerformanceStatus | null> {
  if (!tabId || !hasAccess) return null;
  try {
    const response = (await browser.tabs.sendMessage(tabId, {
      type: 'GET_STATUS',
    })) as ContentResponse;
    return response.ok && 'status' in response ? response.status : null;
  } catch {
    return null;
  }
}

async function ensureContentScript(): Promise<boolean> {
  if (!tabId || !hasAccess) return false;
  try {
    const response = (await browser.runtime.sendMessage({
      type: 'ENSURE_CONTENT_SCRIPT',
      tabId,
    })) as BackgroundResponse;
    return response.ok;
  } catch {
    return false;
  }
}

async function resetAllowedSites(): Promise<void> {
  const permissions = await browser.permissions.getAll();
  const origins = (permissions.origins ?? []).filter((origin) =>
    origin.startsWith('http://') || origin.startsWith('https://'),
  );

  if (!origins.length) return;

  await browser.permissions.remove({ origins });
  hasAccess = false;
  await refreshStatus();
}

async function applyToPage(next: NightfallSettings): Promise<PerformanceStatus | null> {
  if (!tabId || !hasAccess) return null;
  if (!(await ensureContentScript())) return null;
  try {
    const response = (await browser.tabs.sendMessage(tabId, {
      type: 'APPLY_SETTINGS',
      settings: next,
    })) as ContentResponse;
    return response.ok && 'status' in response ? response.status : null;
  } catch {
    return null;
  }
}

async function persist(next: NightfallSettings) {
  const revision = ++persistRevision;
  settings = { ...next, revision: settings.revision + 1 };
  const snapshot = settings;
  render(null);
  try {
    const [status] = await Promise.all([
      applyToPage(snapshot),
      enqueuePersist(() => saveSettings(snapshot)),
    ]);
    if (revision !== persistRevision) return;
    render(status ?? (await getStatus()));
  } catch {
    if (revision === persistRevision) await refreshStatus();
  }
}

function render(status: PerformanceStatus | null) {
  const siteSettings = hostname
    ? getSiteSettings(settings, hostname)
    : getSiteSettings(settings, '');
  const selectedMode = siteSettings.mode;
  const pageRepairs = repairsForPath(siteSettings.repairs, pagePath(currentUrl));
  const modeButtons = modeOptions
    .map(
      ({ mode, label, title }) => {
        const originalAppearance = status
          ? (status.nativeDark ? 'Dark' : 'Light')
          : 'Detecting…';
        return `
        <button class="mode-button" data-mode="${mode}" aria-pressed="${selectedMode === mode}" aria-label="${mode === 'original' ? `Original - ${originalAppearance}` : label}" title="${title}">
          <span>${label}</span>
          ${mode === 'original' ? `<small>${originalAppearance}</small>` : ''}
        </button>`;
      },
    )
    .join('');

  app.innerHTML = `
    <header>
      <div class="mark" aria-hidden="true"><span></span></div>
      <div>
        <h1>Nightfall</h1>
        <p class="site">${hostname || 'This page is protected'}</p>
      </div>
    </header>

    ${hasAccess ? `<section class="mode" aria-label="Page appearance">${modeButtons}</section>` : ''}

    ${hasAccess ? `
      <section class="element-fixes" aria-label="Element fixes">
        <div class="fix-copy">
          <strong>Fix an element</strong>
          <small>${pageRepairs.length ? `${pageRepairs.length} saved on this page` : 'Pick anything the theme missed'}</small>
        </div>
        <button class="inspect-button" id="inspect-element" title="Select an element on the page" ${selectedMode === 'original' ? 'disabled' : ''}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 2.5h7v2h-5v5h-2v-7Zm6.9 6.25 6.1 2.42-2.6 1.18 1.57 3.15-1.8.9-1.55-3.13-2.22 2.13.5-6.65Z"/></svg>
          Inspect
        </button>
        ${pageRepairs.length ? `<button class="clear-fixes" id="clear-fixes" title="Remove saved fixes from this page">Clear</button>` : ''}
      </section>
      ${selectedMode === 'original' ? '<p class="fix-hint">Choose a dark appearance before fixing elements.</p>' : ''}
    ` : ''}

    ${hasAccess ? '' : `
      <section class="permission">
        <strong>Allow Nightfall on this site</strong>
        <p>Access includes this site’s subdomains and is used only on this device.</p>
        <button id="grant-access" ${hostname ? '' : 'disabled'}>Allow this site</button>
      </section>
    `}

    ${isDevMode ? `
      <section class="permission dev-tools">
        <strong>Dev tools</strong>
        <p>Reset allowed sites without opening browser settings.</p>
        <button id="reset-allowed-sites">Reset allowed sites</button>
      </section>
    ` : ''}

    <footer>No tracking · No account · Settings stay on this device</footer>
  `;

  bindEvents();
}

function bindEvents() {
  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode as Mode;
      if (!hostname || mode === getSiteSettings(settings, hostname).mode) return;
      void persist({
        ...updateSiteSettings(settings, hostname, { mode }),
        mode,
      });
    });
  });

  app.querySelector<HTMLButtonElement>('#grant-access')?.addEventListener('click', async () => {
    const pattern = permissionPattern();
    if (!pattern || !tabId) return;
    void browser.runtime.sendMessage({
      type: 'ARM_POPUP_REOPEN',
      tabId,
      pattern,
    } satisfies BackgroundMessage);
    const granted = await browser.permissions.request({ origins: [pattern] });
    if (!granted) {
      void browser.runtime.sendMessage({
        type: 'DISARM_POPUP_REOPEN',
      } satisfies BackgroundMessage);
      return;
    }

    hasAccess = true;
    render(null);

    void ensureContentScript().then(refreshStatus);
  });

  app.querySelector<HTMLButtonElement>('#reset-allowed-sites')?.addEventListener('click', () => {
    void resetAllowedSites();
  });

  app.querySelector<HTMLButtonElement>('#inspect-element')?.addEventListener('click', async () => {
    if (!tabId || !(await ensureContentScript())) return;
    try {
      const response = (await browser.tabs.sendMessage(tabId, {
        type: 'START_ELEMENT_PICKER',
      })) as ContentResponse;
      if (response.ok) window.close();
    } catch {
      await refreshStatus();
    }
  });

  app.querySelector<HTMLButtonElement>('#clear-fixes')?.addEventListener('click', () => {
    if (!hostname) return;
    const site = getSiteSettings(settings, hostname);
    const path = pagePath(currentUrl);
    void persist(updateSiteSettings(settings, hostname, {
      repairs: site.repairs.filter((repair) => repair.path !== path),
    }));
  });

}

async function refreshStatus() {
  render(await getStatus());
}

async function init() {
  try {
    [settings] = await Promise.all([loadSettings(), getActiveTab()]);

    // Paint the popup before optional page messaging or action cleanup. Those
    // APIs can reject on restricted pages or while a dev build is reloading.
    render(null);

    if (tabId) {
      void Promise.all([
        browser.action.setBadgeText({ text: '', tabId }),
        browser.action.setTitle({ title: 'Nightfall', tabId }),
      ]).catch(() => undefined);
    }

    await ensureContentScript();
    await refreshStatus();
  } catch (error) {
    console.error('Unable to initialize the Nightfall popup', error);
    render(null);
  }
}

void init();

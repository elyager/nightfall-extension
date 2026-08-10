import {
  CONTENT_PROTOCOL_VERSION,
  type BackgroundMessage,
  type BackgroundResponse,
  type ContentResponse,
} from '@/utils/messages';
import { sitePermissionPattern } from '@/utils/permissions';
import { getSiteSettings, loadSettings, saveSettings, updateSiteSettings } from '@/utils/settings';
import {
  createAiThemeRequest,
  AI_LOGS_KEY,
  OPENROUTER_ENDPOINT,
  OPENROUTER_ORIGIN,
  parseAiThemeResponse,
  type AiLogEntry,
} from '@/utils/ai-theme';

declare const __DEV_SERVER_ORIGIN__: string;

interface DevServerMessage {
  type?: string;
  event?: string;
}

export default defineBackground(() => {
  const scriptId = 'nightfall-engine';
  const bootstrapScripts = [
    { id: 'nightfall-bootstrap-slate-blue', mode: 'slate-blue', css: '/bootstrap/slate-blue.css' },
    { id: 'nightfall-bootstrap-linear-dark', mode: 'linear-dark', css: '/bootstrap/linear-dark.css' },
    { id: 'nightfall-bootstrap-github-dark', mode: 'github-dark', css: '/bootstrap/github-dark.css' },
  ] as const;
  let registrationQueue: Promise<void> = Promise.resolve();
  let pendingPopupReopen: {
    tabId: number;
    pattern: string;
    expiresAt: number;
  } | null = null;

  const appendAiLog = async (entry: AiLogEntry): Promise<void> => {
    console.info('[Nightfall AI]', entry);
    try {
      const stored = await browser.storage.local.get(AI_LOGS_KEY);
      const current = Array.isArray(stored[AI_LOGS_KEY])
        ? stored[AI_LOGS_KEY] as AiLogEntry[]
        : [];
      await browser.storage.local.set({
        [AI_LOGS_KEY]: [entry, ...current].slice(0, 20),
      });
    } catch (error) {
      console.warn('[Nightfall AI] Unable to persist response log', error);
    }
  };

  const syncRegisteredOrigins = async () => {
    const [permissions, settings] = await Promise.all([
      browser.permissions.getAll(),
      loadSettings(),
    ]);
    const origins = (permissions.origins ?? [])
      .filter((origin) => origin.startsWith('http://') || origin.startsWith('https://'))
      .filter((origin) => origin !== OPENROUTER_ORIGIN)
      .sort();
    const registrationIds = [scriptId, ...bootstrapScripts.map(({ id }) => id)];
    const existing = await browser.scripting.getRegisteredContentScripts({
      ids: registrationIds,
    });
    const existingIds = new Set(existing.map(({ id }) => id));

    if (!origins.length) {
      if (existing.length) {
        await browser.scripting.unregisterContentScripts({ ids: existing.map(({ id }) => id) });
      }
      return;
    }

    const registration = {
      id: scriptId,
      js: ['/content-scripts/content.js'],
      matches: origins,
      runAt: 'document_start' as const,
      allFrames: true,
      matchOriginAsFallback: true,
      persistAcrossSessions: true,
    };

    if (!existingIds.has(scriptId)) {
      await browser.scripting.registerContentScripts([registration]);
    } else {
      await browser.scripting.updateContentScripts([registration]);
    }

    for (const bootstrap of bootstrapScripts) {
      const matches = origins.filter((origin) => {
        try {
          const hostname = new URL(origin.replace('*.', '')).hostname;
          const site = getSiteSettings(settings, hostname);
          return site.enabled && site.mode === bootstrap.mode;
        } catch {
          return false;
        }
      });
      if (!matches.length) {
        if (existingIds.has(bootstrap.id)) {
          await browser.scripting.unregisterContentScripts({ ids: [bootstrap.id] });
        }
        continue;
      }
      const bootstrapRegistration = {
        id: bootstrap.id,
        css: [bootstrap.css],
        matches,
        runAt: 'document_start' as const,
        allFrames: true,
        matchOriginAsFallback: true,
        persistAcrossSessions: true,
      };
      if (existingIds.has(bootstrap.id)) {
        await browser.scripting.updateContentScripts([bootstrapRegistration]);
      } else {
        await browser.scripting.registerContentScripts([bootstrapRegistration]);
      }
    }
  };

  const scheduleRegistrationSync = () => {
    const pending = registrationQueue.then(syncRegisteredOrigins);
    registrationQueue = pending.catch(() => undefined);
    return pending;
  };

  const pingContentScript = async (tabId: number) => {
    try {
      const response = (await browser.tabs.sendMessage(tabId, {
        type: 'GET_STATUS',
      })) as ContentResponse | undefined;
      return response?.ok === true && response.protocolVersion === CONTENT_PROTOCOL_VERSION;
    } catch {
      return false;
    }
  };

  const ensureContentScript = async (tabId: number) => {
    await registrationQueue;
    const tab = await browser.tabs.get(tabId);
    const pattern = sitePermissionPattern(tab.url ?? '');
    if (!pattern) throw new Error('Nightfall cannot run on this page');
    const hasAccess = await browser.permissions.contains({ origins: [pattern] });
    if (!hasAccess) throw new Error('Nightfall does not have access to this site');

    if (await pingContentScript(tabId)) return;
    await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['/content-scripts/content.js'],
    });
  };

  const reloadActiveTabContentScript = async () => {
    await scheduleRegistrationSync();
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id == null) return;
    const pattern = sitePermissionPattern(tab.url ?? '');
    if (!pattern) return;
    const hasAccess = await browser.permissions.contains({ origins: [pattern] });
    if (!hasAccess) return;
    await browser.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['/content-scripts/content.js'],
    });
  };

  if (import.meta.env.COMMAND === 'serve') {
    const devServer = new WebSocket(__DEV_SERVER_ORIGIN__, 'vite-hmr');
    devServer.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data)) as DevServerMessage;
        if (message.type !== 'custom' || message.event !== 'nightfall:reload-active-tab') return;
        void reloadActiveTabContentScript().catch((error: unknown) => {
          console.warn('[Nightfall] Unable to refresh the active tab', error);
        });
      } catch {
        // Ignore unrelated Vite dev-server messages.
      }
    });
  }

  void scheduleRegistrationSync().catch(() => undefined);
  browser.runtime.onInstalled.addListener(() => {
    void scheduleRegistrationSync().catch(() => undefined);
  });
  browser.runtime.onStartup.addListener(() => {
    void scheduleRegistrationSync().catch(() => undefined);
  });
  browser.permissions.onAdded.addListener((permissions) => {
    void scheduleRegistrationSync().catch(() => undefined);

    const pending = pendingPopupReopen;
    if (
      !pending ||
      pending.expiresAt < Date.now() ||
      !permissions.origins?.includes(pending.pattern)
    ) return;

    pendingPopupReopen = null;
    setTimeout(() => {
      void browser.tabs.get(pending.tabId)
        .then(async (tab) => {
          if (!tab.active) return;
          await browser.action.setBadgeText({ text: '✓', tabId: pending.tabId });
          await browser.action.setTitle({
            title: 'Access allowed — click to choose an appearance',
            tabId: pending.tabId,
          });
          await browser.action.openPopup({ windowId: tab.windowId });
        })
        .catch(() => undefined);
    }, 150);
  });
  browser.permissions.onRemoved.addListener(() => {
    void scheduleRegistrationSync().catch(() => undefined);
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.nightfallSettings) {
      void scheduleRegistrationSync().catch(() => undefined);
    }
  });

  browser.runtime.onMessage.addListener(
    (message: BackgroundMessage, _sender, sendResponse) => {
      if (message?.type === 'ARM_POPUP_REOPEN') {
        pendingPopupReopen = {
          tabId: message.tabId,
          pattern: message.pattern,
          expiresAt: Date.now() + 60_000,
        };
        return;
      }

      if (message?.type === 'DISARM_POPUP_REOPEN') {
        pendingPopupReopen = null;
        return;
      }

      if (message?.type === 'GENERATE_AI_THEME') {
        const apiKey = message.apiKey.trim();
        if (!apiKey || apiKey.length > 512) {
          sendResponse({ ok: false, error: 'Enter a valid OpenRouter API key' } satisfies BackgroundResponse);
          return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 75_000);
        void (async () => {
          let httpStatus = 0;
          let responseText = '';
          let failure = '';
          let attempt = 1;
          try {
            for (attempt = 1; attempt <= 2; attempt += 1) {
              const response = await fetch(OPENROUTER_ENDPOINT, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(createAiThemeRequest(
                  message.snapshot,
                  message.requireZdr,
                  attempt === 1 ? 1_800 : 3_200,
                )),
                signal: controller.signal,
              });
              httpStatus = response.status;
              responseText = (await response.text()).slice(0, 40_000);
              let result: unknown;
              try { result = JSON.parse(responseText); } catch { result = undefined; }
              if (!response.ok) {
                const apiError = result && typeof result === 'object' && 'error' in result
                  ? (result as { error?: { message?: unknown } }).error?.message
                  : undefined;
                throw new Error(typeof apiError === 'string' ? apiError : `OpenRouter request failed (${response.status})`);
              }
              const choice = result && typeof result === 'object' && 'choices' in result
                ? (result as { choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }> }).choices?.[0]
                : undefined;
              const truncated = choice?.finish_reason === 'length' || typeof choice?.message?.content !== 'string';
              if (truncated && attempt === 1) {
                await appendAiLog({
                  id: crypto.randomUUID(),
                  timestamp: new Date().toISOString(),
                  httpStatus,
                  requireZdr: message.requireZdr,
                  ok: false,
                  attempt,
                  responseText,
                  error: 'The model exhausted its output budget before returning JSON. Retrying automatically with a larger budget.',
                });
                continue;
              }
              if (truncated) {
                throw new Error('OpenRouter exhausted the output budget twice without returning the theme JSON');
              }
              const theme = parseAiThemeResponse(result);
              await appendAiLog({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                httpStatus,
                requireZdr: message.requireZdr,
                ok: true,
                attempt,
                responseText,
              });
              sendResponse({ ok: true, theme } satisfies BackgroundResponse);
              return;
            }
          } catch (error: unknown) {
            failure = error instanceof Error && error.name === 'AbortError'
              ? 'OpenRouter timed out. Try again.'
              : error instanceof Error ? error.message : 'Unable to generate the AI theme';
            await appendAiLog({
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              httpStatus,
              requireZdr: message.requireZdr,
              ok: false,
              attempt,
              responseText,
              error: failure,
            });
            sendResponse({ ok: false, error: failure } satisfies BackgroundResponse);
          } finally {
            clearTimeout(timeout);
          }
        })();
        return true;
      }

      if (message?.type !== 'ENSURE_CONTENT_SCRIPT') return;

      void scheduleRegistrationSync()
        .then(async () => {
          await ensureContentScript(message.tabId);
          sendResponse({ ok: true } satisfies BackgroundResponse);
        })
        .catch((error: unknown) =>
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : 'Unable to start Nightfall',
          } satisfies BackgroundResponse),
        );
      return true;
    },
  );

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'toggle-nightfall' || !tab?.id || !tab.url) return;
    const url = new URL(tab.url);
    if (!['http:', 'https:'].includes(url.protocol)) return;

    const settings = await loadSettings();
    const site = getSiteSettings(settings, url.hostname);
    const next = {
      ...updateSiteSettings(settings, url.hostname, {
        enabled: !site.enabled,
      }),
      revision: settings.revision + 1,
    };
    await saveSettings(next);
    await ensureContentScript(tab.id);
    await browser.tabs.sendMessage(tab.id, {
      type: 'APPLY_SETTINGS',
      settings: next,
    });
  });
});

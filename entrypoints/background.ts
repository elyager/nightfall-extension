import {
  CONTENT_PROTOCOL_VERSION,
  type BackgroundMessage,
  type BackgroundResponse,
  type ContentResponse,
} from '@/utils/messages';
import { sitePermissionPattern } from '@/utils/permissions';
import { getSiteSettings, loadSettings, saveSettings, updateSiteSettings } from '@/utils/settings';

export default defineBackground(() => {
  const scriptId = 'nightfall-engine';
  let registrationQueue: Promise<void> = Promise.resolve();
  let pendingPopupReopen: {
    tabId: number;
    pattern: string;
    expiresAt: number;
  } | null = null;

  const syncRegisteredOrigins = async () => {
    const permissions = await browser.permissions.getAll();
    const origins = (permissions.origins ?? [])
      .filter((origin) => origin.startsWith('http://') || origin.startsWith('https://'))
      .sort();
    const [existing] = await browser.scripting.getRegisteredContentScripts({
      ids: [scriptId],
    });

    if (!origins.length) {
      if (existing) {
        await browser.scripting.unregisterContentScripts({ ids: [scriptId] });
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

    if (!existing) {
      await browser.scripting.registerContentScripts([registration]);
      return;
    }

    await browser.scripting.updateContentScripts([registration]);
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
      })) as ContentResponse;
      return response.ok && response.protocolVersion === CONTENT_PROTOCOL_VERSION;
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

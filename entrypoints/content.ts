import {
  CONTENT_PROTOCOL_VERSION,
  type ContentMessage,
  type ContentResponse,
} from '@/utils/messages';
import { NightfallEngine } from '@/utils/engine';
import {
  getSiteSettings,
  STORAGE_KEY,
  loadSettings,
  normalizeSettings,
  saveSettings,
  type NightfallSettings,
  updateSiteSettings,
} from '@/utils/settings';
import { createStableSelector, pagePath } from '@/utils/repairs';

const CONTENT_INSTANCE_KEY = '__nightfallContentInstanceV1';

interface ContentInstance {
  dispose: () => void;
  protocolVersion: number;
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  registration: 'runtime',
  runAt: 'document_start',
  allFrames: true,
  matchOriginAsFallback: true,
  main() {
    const contentScope = globalThis as typeof globalThis & {
      [CONTENT_INSTANCE_KEY]?: boolean | ContentInstance;
    };
    const existingInstance = contentScope[CONTENT_INSTANCE_KEY];
    if (
      typeof existingInstance === 'object' &&
      existingInstance.protocolVersion === CONTENT_PROTOCOL_VERSION
    ) {
      return;
    }
    if (typeof existingInstance === 'object') existingInstance.dispose();

    const engine = new NightfallEngine();
    let lastSettingsSignature = '';
    let latestRevision = 0;
    let activeApply = engine.start();
    let stopPicker: (() => void) | undefined;

    const showToast = (message: string) => {
      document.getElementById('nightfall-picker-toast')?.remove();
      const toast = document.createElement('div');
      toast.id = 'nightfall-picker-toast';
      toast.textContent = message;
      Object.assign(toast.style, {
        position: 'fixed',
        right: '18px',
        bottom: '18px',
        zIndex: '2147483647',
        padding: '10px 14px',
        border: '1px solid #4ba8d5',
        borderRadius: '9px',
        background: '#111820',
        color: '#e8f7ff',
        boxShadow: '0 10px 32px rgba(0,0,0,.4)',
        font: '600 12px/1.3 system-ui, sans-serif',
      });
      document.documentElement.append(toast);
      window.setTimeout(() => toast.remove(), 2200);
    };

    const startElementPicker = () => {
      stopPicker?.();
      const host = document.createElement('div');
      host.id = 'nightfall-element-picker';
      const shadow = host.attachShadow({ mode: 'closed' });
      const overlay = document.createElement('div');
      const label = document.createElement('div');
      const hint = document.createElement('div');
      overlay.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #55c2ff;background:rgba(60,174,235,.16);box-sizing:border-box;display:none';
      label.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;padding:4px 7px;border-radius:5px;background:#1676a8;color:white;font:600 11px/1.2 ui-monospace,monospace;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:none';
      hint.textContent = 'Click to select · ↑ parent · ↓ child · Esc cancel';
      hint.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;top:12px;left:50%;transform:translateX(-50%);padding:8px 12px;border:1px solid #4ba8d5;border-radius:8px;background:#111820;color:#e8f7ff;box-shadow:0 8px 28px rgba(0,0,0,.35);font:600 12px/1.2 system-ui,sans-serif';
      shadow.append(overlay, label, hint);
      document.documentElement.append(host);
      const cursorStyle = document.createElement('style');
      cursorStyle.id = 'nightfall-picker-cursor';
      cursorStyle.textContent = 'html, html * { cursor: crosshair !important; }';
      document.documentElement.append(cursorStyle);
      let hoveredTarget: Element | null = null;
      let target: Element | null = null;

      const showTarget = (next: Element) => {
        target = next;
        const rect = next.getBoundingClientRect();
        overlay.style.display = 'block';
        overlay.style.left = `${rect.left}px`;
        overlay.style.top = `${rect.top}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        label.textContent = next.localName + (next.id ? `#${next.id}` : '');
        label.style.display = 'block';
        label.style.left = `${Math.max(4, rect.left)}px`;
        label.style.top = `${Math.max(4, rect.top - 25)}px`;
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('click', onClick, true);
        window.removeEventListener('keydown', onKeyDown, true);
        host.remove();
        cursorStyle.remove();
        if (stopPicker === cleanup) stopPicker = undefined;
      };
      const onPointerMove = (event: PointerEvent) => {
        const next = event.composedPath().find(
          (item): item is Element =>
            item instanceof Element &&
            item.getRootNode() === document &&
            !item.id.startsWith('nightfall-'),
        );
        if (!next) return;
        if (next === hoveredTarget) return;
        hoveredTarget = next;
        showTarget(next);
      };
      const onClick = (event: MouseEvent) => {
        if (!target) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const selected = target;
        cleanup();
        void (async () => {
          const selector = createStableSelector(selected);
          if (!selector) throw new Error('No stable selector could be created');
          const latest = await loadSettings();
          const site = getSiteSettings(latest, location.hostname);
          const repair = { selector, path: pagePath(location.href) };
          const repairs = site.repairs.some(
            (item) => item.selector === repair.selector && item.path === repair.path,
          ) ? site.repairs : [...site.repairs, repair];
          const next = {
            ...updateSiteSettings(latest, location.hostname, { repairs }),
            revision: latest.revision + 1,
          };
          await saveSettings(next);
          await applySettings(next);
          showToast('Element fix saved for this page');
        })().catch(() => showToast('Nightfall could not save this element'));
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cleanup();
          showToast('Element picker cancelled');
          return;
        }
        if (!target || !hoveredTarget) return;
        if (event.key === 'ArrowUp') {
          const parent = target.parentElement;
          if (!parent || parent === document.documentElement) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          showTarget(parent);
          return;
        }
        if (event.key === 'ArrowDown' && target !== hoveredTarget) {
          let child = hoveredTarget;
          while (child.parentElement && child.parentElement !== target) {
            child = child.parentElement;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          showTarget(child);
        }
      };
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('click', onClick, true);
      window.addEventListener('keydown', onKeyDown, true);
      stopPicker = cleanup;
    };

    const applySettings = (settings: Awaited<ReturnType<typeof loadSettings>>) => {
      if (settings.revision < latestRevision) return activeApply;
      latestRevision = settings.revision;
      const signature = JSON.stringify(settings);
      if (signature === lastSettingsSignature) return activeApply;
      lastSettingsSignature = signature;
      activeApply = engine.start(settings);
      return activeApply;
    };

    const messageListener = (
      message: ContentMessage,
      _sender: Browser.runtime.MessageSender,
      sendResponse: (response: ContentResponse) => void,
    ) => {
        if (message.type === 'GET_STATUS') {
          sendResponse({
            ok: true,
            protocolVersion: CONTENT_PROTOCOL_VERSION,
            status: engine.getStatus(),
          } satisfies ContentResponse);
          return;
        }
        if (message.type === 'START_ELEMENT_PICKER') {
          startElementPicker();
          sendResponse({
            ok: true,
            protocolVersion: CONTENT_PROTOCOL_VERSION,
            picking: true,
          } satisfies ContentResponse);
          return;
        }
        if (message.type === 'GET_PAGE_STYLE_SNAPSHOT') {
          void engine.collectOriginalPageStyleSnapshot()
            .then((snapshot) => sendResponse({
              ok: true,
              protocolVersion: CONTENT_PROTOCOL_VERSION,
              snapshot,
            } satisfies ContentResponse))
            .catch((error: unknown) => sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : 'Unable to inspect page styles',
            } satisfies ContentResponse));
          return true;
        }
        void applySettings(message.settings)
          .then(() =>
            sendResponse({
              ok: true,
              protocolVersion: CONTENT_PROTOCOL_VERSION,
              status: engine.getStatus(),
            } satisfies ContentResponse),
          )
          .catch((error: unknown) =>
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : 'Unable to apply settings',
            } satisfies ContentResponse),
          );
        return true;
      };
    browser.runtime.onMessage.addListener(messageListener);

    const storageListener = (
      changes: Record<string, Browser.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'local' || !changes[STORAGE_KEY]) return;
      void applySettings(
        normalizeSettings(changes[STORAGE_KEY].newValue as Partial<NightfallSettings>),
      );
    };
    browser.storage.onChanged.addListener(storageListener);

    const refresh = () => engine.refreshSoon();
    const refreshRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) engine.refreshSoon();
    };
    window.addEventListener('popstate', refresh);
    window.addEventListener('hashchange', refresh);
    window.addEventListener('pageshow', refreshRestoredPage);

    contentScope[CONTENT_INSTANCE_KEY] = {
      protocolVersion: CONTENT_PROTOCOL_VERSION,
      dispose() {
        browser.runtime.onMessage.removeListener(messageListener);
        browser.storage.onChanged.removeListener(storageListener);
        window.removeEventListener('popstate', refresh);
        window.removeEventListener('hashchange', refresh);
        window.removeEventListener('pageshow', refreshRestoredPage);
        engine.stop();
        stopPicker?.();
      },
    };
  },
});

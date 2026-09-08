import type { NightfallSettings, PerformanceStatus } from './settings';

export const CONTENT_PROTOCOL_VERSION = 5;

export type ContentMessage =
  | { type: 'GET_STATUS' }
  | { type: 'APPLY_SETTINGS'; settings: NightfallSettings }
  | { type: 'START_ELEMENT_PICKER' }
  | { type: 'GET_PAGE_STYLE_SNAPSHOT' };

export type ContentResponse =
  | {
      ok: true;
      protocolVersion: typeof CONTENT_PROTOCOL_VERSION;
      status: PerformanceStatus;
    }
  | { ok: true; protocolVersion: typeof CONTENT_PROTOCOL_VERSION; picking: true }
  | { ok: true; protocolVersion: typeof CONTENT_PROTOCOL_VERSION; snapshot: import('./ai-theme').PageStyleSnapshot }
  | { ok: false; error: string };

export type BackgroundMessage =
  | { type: 'INSTALL_THEME_OVERRIDES' }
  | { type: 'ENSURE_CONTENT_SCRIPT'; tabId: number }
  | { type: 'ARM_POPUP_REOPEN'; tabId: number; pattern: string }
  | { type: 'DISARM_POPUP_REOPEN' }
  | {
      type: 'GENERATE_AI_THEME';
      apiKey: string;
      snapshot: import('./ai-theme').PageStyleSnapshot;
      requireZdr: boolean;
    };

export type BackgroundResponse =
  | { ok: true; theme?: import('./theme').ThemePalette }
  | { ok: false; error: string };

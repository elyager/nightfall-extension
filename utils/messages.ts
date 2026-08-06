import type { NightfallSettings, PerformanceStatus } from './settings';

export const CONTENT_PROTOCOL_VERSION = 3;

export type ContentMessage =
  | { type: 'GET_STATUS' }
  | { type: 'APPLY_SETTINGS'; settings: NightfallSettings }
  | { type: 'START_ELEMENT_PICKER' };

export type ContentResponse =
  | {
      ok: true;
      protocolVersion: typeof CONTENT_PROTOCOL_VERSION;
      status: PerformanceStatus;
    }
  | { ok: true; protocolVersion: typeof CONTENT_PROTOCOL_VERSION; picking: true }
  | { ok: false; error: string };

export type BackgroundMessage =
  | { type: 'ENSURE_CONTENT_SCRIPT'; tabId: number }
  | { type: 'ARM_POPUP_REOPEN'; tabId: number; pattern: string }
  | { type: 'DISARM_POPUP_REOPEN' };

export type BackgroundResponse =
  | { ok: true }
  | { ok: false; error: string };

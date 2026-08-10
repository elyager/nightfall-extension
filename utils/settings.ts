import { browser } from 'wxt/browser';

import type { ThemePalette, ThemePreset } from './theme';
import { contrastRatio, luminance, parseHex, parseRgb } from './color';

export type Mode = ThemePreset;
export interface ElementRepair {
  selector: string;
  path: string;
}

export interface SiteSettings {
  enabled: boolean;
  mode: Mode;
  repairs: ElementRepair[];
  aiTheme?: ThemePalette;
}

export interface NightfallSettings {
  revision: number;
  mode: Mode;
  imageBrightness: number;
  sites: Record<string, SiteSettings>;
}

export interface PerformanceStatus {
  mode: Mode;
  active: boolean;
  nativeDark: boolean;
  path: 'off' | 'native' | 'fast' | 'adaptive';
  startupMs: number;
  processedNodes: number;
}

export const STORAGE_KEY = 'nightfallSettings';

export const DEFAULT_SETTINGS: NightfallSettings = {
  revision: 0,
  mode: 'original',
  imageBrightness: 100,
  sites: {},
};

type NightfallSettingsInput = Omit<Partial<NightfallSettings>, 'sites'> & {
  sites?: Record<string, Partial<SiteSettings>>;
};

export function normalizeSettings(
  value?: NightfallSettingsInput,
): NightfallSettings {
  const revision = value?.revision;
  const sites = Object.fromEntries(
    Object.entries(value?.sites ?? {}).map(([hostname, site]) => {
      const aiTheme = normalizeAiTheme(site.aiTheme);
      return [hostname, {
        enabled: site.enabled ?? true,
        mode: normalizeMode(site.mode),
        repairs: normalizeRepairs(site.repairs),
        ...(aiTheme ? { aiTheme } : {}),
      }];
    }),
  );
  return {
    revision: Number.isSafeInteger(revision) ? revision! : 0,
    mode: normalizeMode(value?.mode),
    imageBrightness: normalizeImageBrightness(value?.imageBrightness),
    sites,
  };
}

function normalizeImageBrightness(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.imageBrightness;
  }
  return Math.round(Math.min(100, Math.max(40, value)));
}

function normalizeMode(value: unknown): Mode {
  if (
    value === 'original' ||
    value === 'slate-blue' ||
    value === 'linear-dark' ||
    value === 'github-dark' ||
    value === 'ai'
  ) {
    return value;
  }
  if (
    value === 'native' ||
    value === 'dimmed-neutral' ||
    value === 'off' ||
    value === 'on' ||
    value === 'auto'
  ) {
    return 'original';
  }
  return DEFAULT_SETTINGS.mode;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SHADOW_COLOR = /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/i;
const AI_COLOR_KEYS: Array<keyof ThemePalette> = [
  'pageBackground', 'surface', 'elevatedSurface', 'textPrimary',
  'textSecondary', 'textMuted', 'textDisabled', 'border', 'borderSubtle',
  'link', 'linkHover', 'linkVisited', 'controlBackground', 'controlHover',
  'controlActive', 'controlDisabled', 'focusRing', 'selectionBackground',
  'selectionText', 'scrollbarTrack', 'scrollbarThumb', 'scrollbarThumbHover',
];

export function normalizeAiTheme(value: unknown): ThemePalette | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ThemePalette>;
  for (const key of AI_COLOR_KEYS) {
    if (typeof candidate[key] !== 'string' || !HEX_COLOR.test(candidate[key])) return undefined;
  }
  if (typeof candidate.shadow !== 'string' || !SHADOW_COLOR.test(candidate.shadow)) return undefined;
  const shadow = parseRgb(candidate.shadow);
  if (!shadow || shadow.r > 255 || shadow.g > 255 || shadow.b > 255) return undefined;
  if (typeof candidate.neutralBlend !== 'number' || !Number.isFinite(candidate.neutralBlend)) return undefined;
  const page = parseHex(candidate.pageBackground!);
  const surface = parseHex(candidate.surface!);
  const primary = parseHex(candidate.textPrimary!);
  const secondary = parseHex(candidate.textSecondary!);
  const link = parseHex(candidate.link!);
  if (
    luminance(page) > 0.25 ||
    luminance(surface) > 0.32 ||
    contrastRatio(primary, page) < 4.5 ||
    contrastRatio(primary, surface) < 4.5 ||
    contrastRatio(secondary, surface) < 3 ||
    contrastRatio(link, page) < 4.5
  ) return undefined;
  return {
    ...(Object.fromEntries(AI_COLOR_KEYS.map((key) => [key, candidate[key]])) as unknown as ThemePalette),
    id: 'ai',
    label: 'AI',
    shadow: candidate.shadow,
    neutralBlend: Math.min(0.95, Math.max(0.55, candidate.neutralBlend)),
  };
}

function normalizeRepairs(value: unknown): ElementRepair[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((repair): repair is Partial<ElementRepair> => Boolean(repair && typeof repair === 'object'))
    .flatMap((repair) => {
      const selector = typeof repair.selector === 'string' ? repair.selector.trim() : '';
      const path = typeof repair.path === 'string' ? repair.path : '';
      if (!selector || selector.length > 1_000 || !path.startsWith('/')) return [];
      const key = `${path}\n${selector}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ selector, path }];
    })
    .slice(0, 100);
}

export async function loadSettings(): Promise<NightfallSettings> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return normalizeSettings(result[STORAGE_KEY] as NightfallSettingsInput);
}

export async function saveSettings(settings: NightfallSettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}

export function getSiteSettings(
  settings: NightfallSettings,
  hostname: string,
): SiteSettings {
  const exact = settings.sites[hostname];
  const inherited = exact ?? findParentSiteSettings(settings, hostname);
  const aiTheme = exact?.aiTheme ?? inherited?.aiTheme;
  return {
    enabled: inherited?.enabled ?? true,
    mode: inherited?.mode ?? 'original',
    // Repairs target a particular site's markup and should not leak into a
    // subdomain just because its appearance is inherited.
    repairs: exact?.repairs ?? [],
    ...(aiTheme ? { aiTheme } : {}),
  };
}

function findParentSiteSettings(
  settings: NightfallSettings,
  hostname: string,
): SiteSettings | undefined {
  const labels = hostname.toLowerCase().split('.');
  for (let index = 1; index < labels.length - 1; index += 1) {
    const parent = settings.sites[labels.slice(index).join('.')];
    if (parent) return parent;
  }
  return undefined;
}

export function updateSiteSettings(
  settings: NightfallSettings,
  hostname: string,
  update: Partial<SiteSettings>,
): NightfallSettings {
  const current = getSiteSettings(settings, hostname);
  return {
    ...settings,
    sites: {
      ...settings.sites,
      [hostname]: { ...current, ...update },
    },
  };
}

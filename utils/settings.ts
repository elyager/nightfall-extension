import { browser } from 'wxt/browser';

import type { ThemePreset } from './theme';

export type Mode = ThemePreset;
export interface ElementRepair {
  selector: string;
  path: string;
}

export interface SiteSettings {
  enabled: boolean;
  mode: Mode;
  repairs: ElementRepair[];
}

export interface NightfallSettings {
  revision: number;
  mode: Mode;
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
    Object.entries(value?.sites ?? {}).map(([hostname, site]) => [
      hostname,
      {
        enabled: site.enabled ?? true,
        mode: normalizeMode(site.mode),
        repairs: normalizeRepairs(site.repairs),
      },
    ]),
  );
  return {
    revision: Number.isSafeInteger(revision) ? revision! : 0,
    mode: normalizeMode(value?.mode),
    sites,
  };
}

function normalizeMode(value: unknown): Mode {
  if (
    value === 'original' ||
    value === 'slate-blue' ||
    value === 'linear-dark' ||
    value === 'github-dark'
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
  return {
    enabled: inherited?.enabled ?? true,
    mode: inherited?.mode ?? 'original',
    // Repairs target a particular site's markup and should not leak into a
    // subdomain just because its appearance is inherited.
    repairs: exact?.repairs ?? [],
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

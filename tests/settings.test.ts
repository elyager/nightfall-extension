import { describe, expect, it } from 'vitest';
import { getSiteSettings, normalizeAiTheme, normalizeSettings, toggleSiteSettings } from '../utils/settings';
import { DARK_THEME } from '../utils/theme';

describe('settings', () => {
  it('uses Original with untouched images as the default', () => {
    expect(normalizeSettings()).toMatchObject({ mode: 'original', imageBrightness: 100, revision: 0 });
  });

  it('constrains image brightness to the supported range', () => {
    expect(normalizeSettings({ imageBrightness: 74.6 }).imageBrightness).toBe(75);
    expect(normalizeSettings({ imageBrightness: 10 }).imageBrightness).toBe(40);
    expect(normalizeSettings({ imageBrightness: 150 }).imageBrightness).toBe(100);
    expect(normalizeSettings({ imageBrightness: Number.NaN }).imageBrightness).toBe(100);
  });

  it.each(['slate-blue', 'linear-dark', 'github-dark'])('migrates %s to the single dark theme', (mode) => {
    const settings = normalizeSettings({ mode, sites: {
      'example.com': {
        enabled: false,
        mode,
        repairs: [{ selector: '#main', path: '/pricing' }],
        aiTheme: { ...DARK_THEME, id: 'ai' },
      },
    } });
    expect(settings.mode).toBe('dark');
    expect(settings.sites['example.com']).toMatchObject({
      enabled: false,
      mode: 'dark',
      repairs: [{ selector: '#main', path: '/pricing' }],
      aiTheme: { id: 'ai', pageBackground: DARK_THEME.pageBackground },
    });
  });

  it.each(['native', 'dimmed-neutral', 'off', 'on', 'auto', 'invalid'])('migrates removed mode %s to Original', (mode) => {
    expect(normalizeSettings({ mode }).mode).toBe('original');
  });

  it.each(['original', 'dark', 'ai'])('preserves the %s appearance mode', (mode) => {
    expect(normalizeSettings({ mode }).mode).toBe(mode);
  });

  it('accepts only constrained AI palette values', () => {
    expect(normalizeAiTheme({ ...DARK_THEME, id: 'ai', neutralBlend: 2 }))
      .toMatchObject({ id: 'ai', label: 'AI', neutralBlend: 0.95 });
    expect(normalizeAiTheme({ ...DARK_THEME, pageBackground: 'red; color: white' })).toBeUndefined();
    expect(normalizeAiTheme({ ...DARK_THEME, shadow: 'url(https://example.com)' })).toBeUndefined();
    expect(normalizeAiTheme({ ...DARK_THEME, textPrimary: '#101010' })).toBeUndefined();
  });

  it('starts each new site on its untouched Original appearance', () => {
    expect(getSiteSettings(normalizeSettings({ mode: 'dark' }), 'mail.google.com')).toEqual({
      enabled: true, mode: 'original', repairs: [],
    });
  });

  it('inherits parent appearance, while keeping repairs local to the exact site', () => {
    const settings = normalizeSettings({ sites: {
      'devpost.com': { mode: 'dark', repairs: [{ selector: '#main', path: '/' }] },
    } });
    expect(getSiteSettings(settings, 'info.devpost.com')).toEqual({
      enabled: true, mode: 'dark', repairs: [],
    });
  });

  it('prefers an exact subdomain appearance over its parent', () => {
    const settings = normalizeSettings({ sites: {
      'devpost.com': { mode: 'dark' },
      'info.devpost.com': { enabled: false, mode: 'ai' },
    } });
    expect(getSiteSettings(settings, 'info.devpost.com')).toEqual({
      enabled: false, mode: 'ai', repairs: [],
    });
  });

  it('discards removed settings and invalid or duplicate repairs', () => {
    const settings = normalizeSettings({
      schedule: { enabled: true, start: '19:00', end: '07:00' },
      sites: { 'example.com': { enabled: false, repairs: [
        { selector: ' #hero ', path: '/pricing' },
        { selector: '#hero', path: '/pricing' },
        { selector: '', path: '/pricing' },
        { selector: '.legacy' },
      ] } },
    } as never);
    expect(settings).not.toHaveProperty('schedule');
    expect(settings.sites['example.com']).toEqual({
      enabled: false, mode: 'original', repairs: [{ selector: '#hero', path: '/pricing' }],
    });
  });

  it('turns Original into Dark with the keyboard shortcut', () => {
    expect(getSiteSettings(toggleSiteSettings(normalizeSettings(), 'example.com'), 'example.com'))
      .toMatchObject({ enabled: true, mode: 'dark' });
  });

  it('toggles a generated AI theme off and back on without losing it', () => {
    const initial = normalizeSettings({ sites: {
      'example.com': { mode: 'ai', aiTheme: { ...DARK_THEME, id: 'ai' } },
    } });
    const off = toggleSiteSettings(initial, 'example.com');
    expect(getSiteSettings(off, 'example.com')).toMatchObject({ enabled: false, mode: 'ai' });
    expect(getSiteSettings(toggleSiteSettings(off, 'example.com'), 'example.com'))
      .toMatchObject({ enabled: true, mode: 'ai', aiTheme: { id: 'ai' } });
  });
});

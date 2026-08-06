import { describe, expect, it } from 'vitest';
import { getSiteSettings, normalizeSettings } from '../utils/settings';

describe('settings', () => {
  it('uses Original as the active default', () => {
    expect(normalizeSettings().mode).toBe('original');
  });

  it('normalizes partial stored values with safe defaults', () => {
    const settings = normalizeSettings({ mode: 'linear-dark' });
    expect(settings).not.toHaveProperty('controls');
    expect(settings.mode).toBe('linear-dark');
    expect(settings.revision).toBe(0);
  });

  it('migrates removed and legacy mode values to Original', () => {
    expect(normalizeSettings({ mode: 'native' } as never).mode).toBe('original');
    expect(normalizeSettings({ mode: 'dimmed-neutral' } as never).mode).toBe('original');
    expect(normalizeSettings({ mode: 'off' } as never).mode).toBe('original');
    expect(normalizeSettings({ mode: 'on' } as never).mode).toBe('original');
    expect(normalizeSettings({ mode: 'auto' } as never).mode).toBe('original');
  });

  it('preserves each available appearance mode', () => {
    expect(normalizeSettings({ mode: 'original' }).mode).toBe('original');
    expect(normalizeSettings({ mode: 'slate-blue' }).mode).toBe('slate-blue');
    expect(normalizeSettings({ mode: 'linear-dark' }).mode).toBe('linear-dark');
    expect(normalizeSettings({ mode: 'github-dark' }).mode).toBe('github-dark');
  });

  it('starts each site on its untouched Original appearance', () => {
    const settings = normalizeSettings({ mode: 'github-dark' });
    expect(getSiteSettings(settings, 'mail.google.com')).toEqual({
      enabled: true,
      mode: 'original',
      repairs: [],
    });
  });

  it('normalizes and preserves a site-specific appearance mode', () => {
    const settings = normalizeSettings({
      sites: {
        'example.com': { enabled: true, mode: 'linear-dark' },
      },
    });
    expect(getSiteSettings(settings, 'example.com').mode).toBe('linear-dark');
  });

  it('inherits a parent site appearance on its subdomains', () => {
    const settings = normalizeSettings({
      sites: {
        'devpost.com': {
          enabled: true,
          mode: 'github-dark',
          repairs: [{ selector: '#main', path: '/' }],
        },
      },
    });

    expect(getSiteSettings(settings, 'info.devpost.com')).toEqual({
      enabled: true,
      mode: 'github-dark',
      repairs: [],
    });
  });

  it('prefers an exact subdomain appearance over its parent site', () => {
    const settings = normalizeSettings({
      sites: {
        'devpost.com': { enabled: true, mode: 'github-dark' },
        'info.devpost.com': { enabled: false, mode: 'slate-blue' },
      },
    });

    expect(getSiteSettings(settings, 'info.devpost.com')).toEqual({
      enabled: false,
      mode: 'slate-blue',
      repairs: [],
    });
  });

  it('discards removed schedule settings and invalid legacy repairs', () => {
    const settings = normalizeSettings({
      schedule: { enabled: true, start: '19:00', end: '07:00' },
      sites: {
        'example.com': {
          enabled: false,
          repairs: [{ selector: '#hero', action: 'original' }],
        },
      },
    } as never);
    expect(settings).not.toHaveProperty('schedule');
    expect(settings.sites['example.com']).toEqual({
      enabled: false,
      mode: 'original',
      repairs: [],
    });
  });

  it('normalizes valid page-specific element repairs', () => {
    const settings = normalizeSettings({
      sites: {
        'example.com': {
          enabled: true,
          mode: 'github-dark',
          repairs: [
            { selector: ' #hero ', path: '/pricing' },
            { selector: '#hero', path: '/pricing' },
            { selector: '', path: '/pricing' },
            { selector: '.legacy' } as never,
          ],
        },
      },
    });

    expect(settings.sites['example.com']!.repairs).toEqual([
      { selector: '#hero', path: '/pricing' },
    ]);
  });
});

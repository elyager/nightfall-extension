import { describe, expect, it } from 'vitest';
import { getBootstrapRegistrations } from '../utils/bootstrap';
import { normalizeSettings } from '../utils/settings';

describe('early dark stylesheet registration', () => {
  it('uses the same fallback for Dark and AI', () => {
    const settings = normalizeSettings({ sites: {
      'example.com': { mode: 'dark' },
      'other.com': { mode: 'ai' },
    } });
    const registrations = getBootstrapRegistrations([
      'https://*.example.com/*', 'https://*.other.com/*',
    ], settings);
    expect(registrations).toHaveLength(2);
    expect(registrations.every(({ css }) => css[0] === '/bootstrap/dark.css')).toBe(true);
  });

  it('excludes a child that explicitly chooses Original', () => {
    const settings = normalizeSettings({ sites: {
      'example.com': { mode: 'dark' },
      'docs.example.com': { mode: 'original' },
    } });
    expect(getBootstrapRegistrations(['https://*.example.com/*'], settings))
      .toMatchObject([{ matches: ['https://*.example.com/*'], excludeMatches: ['https://*.docs.example.com/*'] }]);
  });

  it('allows a deeper dark override inside a disabled child', () => {
    const settings = normalizeSettings({ sites: {
      'example.com': { mode: 'dark' },
      'docs.example.com': { enabled: false, mode: 'dark' },
      'app.docs.example.com': { mode: 'dark' },
    } });
    const registrations = getBootstrapRegistrations(['https://*.example.com/*'], settings);
    expect(registrations).toHaveLength(2);
    expect(registrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ matches: ['https://*.app.docs.example.com/*'], excludeMatches: [] }),
      expect.objectContaining({ matches: ['https://*.example.com/*'], excludeMatches: ['https://*.docs.example.com/*'] }),
    ]));
  });

  it('registers a dark child even when its permitted parent is Original', () => {
    const settings = normalizeSettings({ sites: { 'app.example.com': { mode: 'dark' } } });
    expect(getBootstrapRegistrations(['https://*.example.com/*'], settings))
      .toMatchObject([{ matches: ['https://*.app.example.com/*'], excludeMatches: [] }]);
  });

  it('keeps configured IP and local hosts exact under broad grants', () => {
    const hosts = ['127.0.0.1', '[::1]', 'localhost', 'app.localhost'];
    const settings = normalizeSettings({ sites: Object.fromEntries(
      hosts.map((hostname) => [hostname, { mode: 'dark' }]),
    ) });
    const registrations = getBootstrapRegistrations(['http://*/*'], settings);
    expect(registrations.flatMap(({ matches }) => matches).sort()).toEqual(
      hosts.map((hostname) => `http://${hostname}/*`).sort(),
    );
  });

  it('stays inside exact permissions and respects disabled sites', () => {
    const settings = normalizeSettings({ sites: {
      'example.com': { enabled: false, mode: 'dark' },
      'app.example.com': { mode: 'dark' },
      '127.0.0.1': { mode: 'dark' },
    } });
    expect(getBootstrapRegistrations(['https://example.com/*', 'http://127.0.0.1/*'], settings))
      .toMatchObject([{ matches: ['http://127.0.0.1/*'], excludeMatches: [] }]);
  });
});

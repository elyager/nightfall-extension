import { describe, expect, it } from 'vitest';
import { sitePermissionPattern } from '../utils/permissions';

describe('site permission patterns', () => {
  it('includes the site and all of its subdomains', () => {
    expect(sitePermissionPattern('https://example.com/path')).toBe(
      'https://*.example.com/*',
    );
    expect(sitePermissionPattern('http://app.example.com')).toBe(
      'http://*.app.example.com/*',
    );
  });

  it('keeps IP address permissions exact', () => {
    expect(sitePermissionPattern('http://127.0.0.1:3000')).toBe(
      'http://127.0.0.1/*',
    );
    expect(sitePermissionPattern('http://[::1]:3000')).toBe('http://[::1]/*');
  });

  it('rejects unsupported and invalid URLs', () => {
    expect(sitePermissionPattern('chrome://extensions')).toBeNull();
    expect(sitePermissionPattern('not a url')).toBeNull();
  });
});

import { getSiteSettings, type NightfallSettings } from './settings';

export const BOOTSTRAP_ID_PREFIX = 'nightfall-bootstrap-';

interface BootstrapScope {
  pattern: string;
  protocol: string;
  hostname: string;
  subdomains: boolean;
}

function scopeForPattern(pattern: string): BootstrapScope | undefined {
  try {
    const url = new URL(pattern.replace('://*.', '://'));
    return {
      pattern,
      protocol: url.protocol,
      hostname: url.hostname,
      subdomains: pattern.includes('://*.') || url.hostname === '*',
    };
  } catch {
    return undefined;
  }
}

function contains(scope: BootstrapScope, hostname: string): boolean {
  return scope.hostname === '*' || hostname === scope.hostname ||
    (scope.subdomains && hostname.endsWith(`.${scope.hostname}`));
}

function childScope(scope: BootstrapScope, hostname: string): BootstrapScope {
  // IP literals and local development hosts have no inherited subdomain scope.
  const exactHost = hostname === 'localhost' || hostname.endsWith('.localhost') ||
    /^[\d.]+$/.test(hostname) || hostname.includes(':');
  return {
    pattern: `${scope.protocol}//${exactHost ? '' : '*.'}${hostname}/*`,
    protocol: scope.protocol,
    hostname,
    subdomains: !exactHost,
  };
}

/** A single fallback stylesheet, scoped so Original/disabled child sites never flash dark. */
export function getBootstrapRegistrations(origins: string[], settings: NightfallSettings) {
  const permitted = origins.flatMap((origin) => {
    const scope = scopeForPattern(origin);
    return scope ? [scope] : [];
  });
  const scopes = new Map(permitted.map((scope) => [scope.pattern, scope]));
  for (const scope of permitted) {
    for (const hostname of Object.keys(settings.sites)) {
      if (hostname !== scope.hostname && contains(scope, hostname)) {
        const child = childScope(scope, hostname);
        scopes.set(child.pattern, child);
      }
    }
  }
  const darkScopes = [...scopes.values()].filter((scope) => {
    const site = getSiteSettings(settings, scope.hostname);
    return site.enabled && site.mode !== 'original';
  }).sort((a, b) => a.pattern.localeCompare(b.pattern));

  return darkScopes.map((scope, index) => ({
    id: `${BOOTSTRAP_ID_PREFIX}${index}`,
    css: ['/bootstrap/dark.css'],
    matches: [scope.pattern],
    excludeMatches: [...scopes.values()]
      .filter((child) => child.protocol === scope.protocol &&
        child.hostname !== scope.hostname && contains(scope, child.hostname))
      .filter((child) => {
        const site = getSiteSettings(settings, child.hostname);
        return !site.enabled || site.mode === 'original';
      })
      .map((child) => child.pattern)
      .sort(),
    runAt: 'document_start' as const,
    allFrames: true,
    matchOriginAsFallback: true,
    persistAcrossSessions: true,
  }));
}

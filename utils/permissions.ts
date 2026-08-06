function isIpAddress(hostname: string): boolean {
  const bareHostname = hostname.replace(/^\[|\]$/g, '');
  return /^[\d.]+$/.test(bareHostname) || bareHostname.includes(':');
}

export function sitePermissionPattern(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;

    const hostname = isIpAddress(url.hostname)
      ? url.hostname
      : `*.${url.hostname}`;
    return `${url.protocol}//${hostname}/*`;
  } catch {
    return null;
  }
}

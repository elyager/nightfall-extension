import type { ElementRepair } from './settings';

export function pagePath(url: string | URL): string {
  try {
    const parsed = typeof url === 'string' ? new URL(url) : url;
    return parsed.pathname || '/';
  } catch {
    return '/';
  }
}

export function repairsForPath(
  repairs: ElementRepair[],
  path: string,
): ElementRepair[] {
  return repairs.filter((repair) => repair.path === path);
}

export function createStableSelector(element: Element): string {
  if (element.id) {
    const selector = `#${CSS.escape(element.id)}`;
    if (document.querySelectorAll(selector).length === 1) return selector;
  }

  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    let part = current.localName;
    const stableClasses = [...current.classList]
      .filter((name) => !name.startsWith('nightfall-'))
      .filter((name) => !/^(active|selected|open|hover|focus|is-|has-)/i.test(name))
      .slice(0, 2);
    if (stableClasses.length) {
      part += stableClasses.map((name) => `.${CSS.escape(name)}`).join('');
    }

    const parent: Element | null = current.parentElement;
    if (parent) {
      const sameTag = [...parent.children].filter(
        (sibling) => sibling.localName === current!.localName,
      );
      const matchingPart = sameTag.filter(
        (sibling) => sibling.localName === current!.localName &&
          stableClasses.every((name) => sibling.classList.contains(name)),
      );
      if (matchingPart.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      }
    }

    parts.unshift(part);
    const selector = parts.join(' > ');
    if (document.querySelectorAll(selector).length === 1) return selector;
    current = parent;
  }
  return parts.join(' > ');
}

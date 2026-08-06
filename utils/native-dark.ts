import { luminance, parseRgb } from './color';

const DARK_TOKENS = new Set([
  'dark',
  'dark-mode',
  'dark-theme',
  'theme-dark',
  'night',
]);

export function detectNativeDark(): boolean {
  const root = document.documentElement;
  const body = document.body;
  const metaScheme = document
    .querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
    ?.content.toLowerCase();
  const declaredScheme = getComputedStyle(root).colorScheme.toLowerCase();
  const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;

  if (
    metaScheme?.trim() === 'dark' ||
    (systemDark && metaScheme?.includes('dark')) ||
    declaredScheme === 'dark'
  ) {
    return true;
  }

  const tokens = [
    ...root.classList,
    root.dataset.theme,
    root.dataset.colorMode,
    body?.dataset.theme,
    body?.dataset.colorMode,
  ].filter(Boolean) as string[];
  if (tokens.some((token) => DARK_TOKENS.has(token.toLowerCase()))) return true;

  for (const element of [root, body]) {
    if (!element) continue;
    const background = parseRgb(getComputedStyle(element).backgroundColor);
    if (background && background.a > 0.7 && luminance(background) < 0.12) {
      return true;
    }
  }

  return false;
}

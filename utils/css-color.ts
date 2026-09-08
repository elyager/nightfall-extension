import { parseRgb, type Rgb } from './color';

type ColorContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const MAX_CACHE_SIZE = 4096;
const cache = new Map<string, Rgb | null>();
let context: ColorContext | null | undefined;

function getColorContext(): ColorContext | null {
  if (context !== undefined) return context;
  context = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      context = new OffscreenCanvas(1, 1).getContext('2d', {
        colorSpace: 'srgb',
        willReadFrequently: true,
      });
    }
  } catch {
    // Some browsers expose OffscreenCanvas without a usable 2D context.
  }
  if (!context && typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      context = canvas.getContext('2d', {
        colorSpace: 'srgb',
        willReadFrequently: true,
      });
    } catch {
      context = null;
    }
  }
  return context;
}

function remember(value: string, color: Rgb | null): Rgb | null {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(value, color);
  return color ? { ...color } : null;
}

/** Resolve concrete computed CSS colors to sRGB without inspecting page content. */
export function parseComputedColor(value: string): Rgb | null {
  const direct = parseRgb(value);
  if (direct) return direct;

  const source = value.trim();
  // Computed colors should be absolute. Relative colors, system colors, and
  // variables depend on an element's context and cannot be resolved by this canvas.
  if (!/^(?:oklab|oklch|lab|lch|color|hsl|hsla|hwb)\(/i.test(source)
    || /\b(?:from|currentcolor)\b|\b(?:var|env|attr|light-dark)\s*\(/i.test(source)) return null;
  if (cache.has(source)) {
    const cached = cache.get(source);
    return cached ? { ...cached } : null;
  }
  if (typeof CSS === 'undefined' || !CSS.supports('color', source)) return remember(source, null);

  const painter = getColorContext();
  if (!painter) return remember(source, null);
  try {
    // Invalid canvas colors silently retain the previous fill. Use two sentinels
    // so a legitimate color equal to the first sentinel still parses correctly.
    painter.fillStyle = '#010203';
    painter.fillStyle = source;
    if (painter.fillStyle === '#010203') {
      painter.fillStyle = '#040506';
      painter.fillStyle = source;
      if (painter.fillStyle === '#040506') return remember(source, null);
    }
    painter.clearRect(0, 0, 1, 1);
    painter.fillRect(0, 0, 1, 1);
    const [r, g, b, alpha] = painter.getImageData(0, 0, 1, 1).data;
    if (r === undefined || g === undefined || b === undefined || alpha === undefined) {
      return remember(source, null);
    }
    return remember(source, { r, g, b, a: alpha / 255 });
  } catch {
    return remember(source, null);
  }
}

export function clearComputedColorCache(): void {
  cache.clear();
  context = undefined;
}

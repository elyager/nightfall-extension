import {
  DARK_THEME,
  type SurfaceLevel,
  type TextRole,
  type ThemePalette,
} from './theme';

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

const BLACK: Rgb = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };
const clamp = (value: number, maximum = 1) => Math.min(maximum, Math.max(0, value));

function numberComponent(value: string, maximum: number): number | null {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(value)) return null;
  const number = Number(value.replace('%', ''));
  if (!Number.isFinite(number)) return null;
  return clamp(value.endsWith('%') ? (number / 100) * maximum : number, maximum);
}

/** Accept the RGB forms emitted by computed styles, including CSS Color 4 sRGB. */
export function parseRgb(value: string): Rgb | null {
  const source = value.trim();
  if (source.toLowerCase() === 'transparent') return { ...BLACK, a: 0 };
  if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(source)) return parseHex(source);
  const match = source.match(/^(rgba?|color)\((.*)\)$/i);
  if (!match) return null;

  const srgb = match[1]!.toLowerCase() === 'color';
  let body = match[2]!.trim();
  if (srgb) {
    if (!/^srgb\s/i.test(body)) return null;
    body = body.replace(/^srgb\s+/i, '');
  }

  let channels: string[];
  let alpha: string | undefined;
  if (body.includes(',')) {
    if (srgb || body.includes('/')) return null;
    const components = body.split(',').map((component) => component.trim());
    if (components.length !== 3 && components.length !== 4) return null;
    channels = components.slice(0, 3);
    alpha = components[3];
  } else {
    const components = body.split('/');
    if (components.length > 2) return null;
    channels = components[0]!.trim().split(/\s+/);
    alpha = components[1]?.trim();
  }
  if (channels.length !== 3) return null;
  const parsed = channels.map((channel) => numberComponent(channel, srgb ? 1 : 255));
  const a = alpha === undefined ? 1 : numberComponent(alpha, 1);
  if (parsed.some((channel) => channel === null) || a === null) return null;
  const [r, g, b] = parsed as [number, number, number];
  const multiplier = srgb ? 255 : 1;
  return { r: r * multiplier, g: g * multiplier, b: b * multiplier, a };
}

export function parseHex(value: string): Rgb {
  const normalized = value.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(normalized)) {
    throw new Error(`Invalid hexadecimal color: ${value}`);
  }
  const expanded = normalized.length <= 4
    ? normalized.split('').map((character) => character.repeat(2)).join('')
    : normalized;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
    a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  };
}

export function luminance(color: Rgb): number {
  const channel = (value: number) => {
    const normalized = clamp(value, 255) / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** Composite two layers without losing the alpha of a transparent backdrop. */
export function composite(foreground: Rgb, background: Rgb): Rgb {
  const foregroundAlpha = clamp(foreground.a);
  const backgroundWeight = clamp(background.a) * (1 - foregroundAlpha);
  const a = foregroundAlpha + backgroundWeight;
  if (a === 0) return { ...BLACK, a: 0 };
  return {
    r: (foreground.r * foregroundAlpha + background.r * backgroundWeight) / a,
    g: (foreground.g * foregroundAlpha + background.g * backgroundWeight) / a,
    b: (foreground.b * foregroundAlpha + background.b * backgroundWeight) / a,
    a,
  };
}

/** Pass an effective, opaque background where possible; otherwise assume a black canvas. */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const backdrop = background.a < 1 ? composite(background, BLACK) : background;
  const first = luminance(composite(foreground, backdrop));
  const second = luminance(backdrop);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function mix(first: Rgb, second: Rgb, weight: number): Rgb {
  return {
    r: first.r + (second.r - first.r) * weight,
    g: first.g + (second.g - first.g) * weight,
    b: first.b + (second.b - first.b) * weight,
    a: first.a,
  };
}

function surfaceColor(palette: ThemePalette, level: SurfaceLevel): string {
  if (level === 'page') return palette.pageBackground;
  if (level === 'interactive') return palette.controlBackground;
  if (level === 'elevated' || level === 'overlay') return palette.elevatedSurface;
  return palette.surface;
}

function textColor(palette: ThemePalette, role: TextRole): string {
  if (role === 'disabled') return palette.textDisabled;
  if (role === 'muted') return palette.textMuted;
  if (role === 'secondary') return palette.textSecondary;
  return palette.textPrimary;
}

export function transformBackground(
  color: Rgb,
  palette: ThemePalette = DARK_THEME,
  level: SurfaceLevel = 'surface',
): Rgb {
  const sourceLuminance = luminance(color);
  const darkThreshold = 0.06;
  if (color.a === 0 || sourceLuminance <= darkThreshold) return { ...color };

  const neutral = parseHex(surfaceColor(palette, level));
  const maximum = Math.max(color.r, color.g, color.b);
  const chroma = (maximum - Math.min(color.r, color.g, color.b)) / Math.max(1, maximum);
  // Bright surfaces approach the palette; darker surfaces meet the untouched
  // range continuously. Colorful surfaces retain more luminance and their hue.
  const floor = Math.min(darkThreshold, luminance(neutral) * (1 + 2 * chroma));
  const progress = (sourceLuminance - darkThreshold) / (1 - darkThreshold);
  const target = floor + (darkThreshold - floor) * (1 - progress) ** 2;
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const factor = (low + high) / 2;
    const candidate = { r: color.r * factor, g: color.g * factor, b: color.b * factor, a: color.a };
    if (luminance(candidate) > target) high = factor;
    else low = factor;
  }
  const tinted = { r: color.r * low, g: color.g * low, b: color.b * low, a: color.a };
  // Apply custom palette tint to near-neutral surfaces without recoloring accents.
  return mix(tinted, neutral, (1 - chroma) * clamp(palette.neutralBlend) * progress);
}

function rounded(color: Rgb): Rgb {
  return { r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b), a: color.a };
}

function contrastCandidate(source: Rgb, endpoint: Rgb, background: Rgb, minimum: number): Rgb {
  const target = { ...endpoint, a: source.a };
  if (contrastRatio(target, background) < minimum) return target;
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const weight = (low + high) / 2;
    if (contrastRatio(rounded(mix(source, target, weight)), background) >= minimum) high = weight;
    else low = weight;
  }
  return rounded(mix(source, target, high));
}

export function transformForeground(
  color: Rgb,
  background: Rgb,
  minimumContrast: number,
  palette: ThemePalette = DARK_THEME,
  role: TextRole = 'primary',
): Rgb {
  const minimum = Math.max(1, minimumContrast);
  const original = rounded(color);
  if (color.a === 0 || contrastRatio(original, background) >= minimum) return { ...color };

  const chroma = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
  const source = chroma >= 12 ? original : { ...parseHex(textColor(palette, role)), a: color.a };
  if (contrastRatio(source, background) >= minimum) return source;

  const candidates = [
    contrastCandidate(source, WHITE, background, minimum),
    contrastCandidate(source, BLACK, background, minimum),
  ];
  const passing = candidates.filter((candidate) => contrastRatio(candidate, background) >= minimum);
  if (!passing.length) {
    // A low authored alpha can make the target impossible. Keep that transparency
    // and return the best available contrast instead of silently making it opaque.
    return candidates.sort((first, second) => contrastRatio(second, background) - contrastRatio(first, background))[0]!;
  }
  const distance = (candidate: Rgb) =>
    (candidate.r - color.r) ** 2 + (candidate.g - color.g) ** 2 + (candidate.b - color.b) ** 2;
  return passing.sort((first, second) => distance(first) - distance(second))[0]!;
}

export function toCss(color: Rgb): string {
  const alpha = clamp(color.a);
  const suffix = alpha < 1 ? ` / ${Number(alpha.toFixed(6))}` : '';
  return `rgb(${Math.round(clamp(color.r, 255))} ${Math.round(clamp(color.g, 255))} ${Math.round(clamp(color.b, 255))}${suffix})`;
}

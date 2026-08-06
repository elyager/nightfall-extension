import {
  SLATE_BLUE,
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

export function parseRgb(value: string): Rgb | null {
  const match = value.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i,
  );
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

export function luminance(color: Rgb): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

export function contrastRatio(first: Rgb, second: Rgb): number {
  const high = Math.max(luminance(first), luminance(second));
  const low = Math.min(luminance(first), luminance(second));
  return (high + 0.05) / (low + 0.05);
}

export function parseHex(value: string): Rgb {
  const normalized = value.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((character) => character.repeat(2)).join('')
    : normalized;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
    a: 1,
  };
}

function mix(first: Rgb, second: Rgb, secondWeight: number): Rgb {
  const firstWeight = 1 - secondWeight;
  return {
    r: first.r * firstWeight + second.r * secondWeight,
    g: first.g * firstWeight + second.g * secondWeight,
    b: first.b * firstWeight + second.b * secondWeight,
    a: first.a,
  };
}

function removePurpleCast(color: Rgb): Rgb {
  if (color.r <= color.g || color.b <= color.g) return color;
  return { ...color, r: color.g };
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
  palette: ThemePalette = SLATE_BLUE,
  level: SurfaceLevel = 'surface',
): Rgb {
  const neutral = parseHex(surfaceColor(palette, level));
  const purpleFree = removePurpleCast(color);
  const max = Math.max(purpleFree.r, purpleFree.g, purpleFree.b, 1);
  const target = level === 'page' ? 24 : level === 'surface' ? 34 : 44;
  const tinted = {
    r: target * (0.68 + 0.32 * (purpleFree.r / max)),
    g: target * (0.68 + 0.32 * (purpleFree.g / max)),
    b: target * (0.68 + 0.32 * (purpleFree.b / max)),
    a: color.a,
  };
  return mix(tinted, neutral, palette.neutralBlend);
}

export function transformForeground(
  color: Rgb,
  background: Rgb,
  minimumContrast: number,
  palette: ThemePalette = SLATE_BLUE,
  role: TextRole = 'primary',
): Rgb {
  let result = { ...parseHex(textColor(palette, role)), a: color.a };

  while (contrastRatio(result, background) < minimumContrast) {
    if (result.r >= 254 && result.g >= 254 && result.b >= 254) break;
    result = {
      ...result,
      r: Math.min(255, result.r + 8),
      g: Math.min(255, result.g + 8),
      b: Math.min(255, result.b + 8),
    };
  }
  return result;
}

export function toCss(color: Rgb): string {
  const alpha = color.a < 1 ? ` / ${color.a.toFixed(2)}` : '';
  return `rgb(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)}${alpha})`;
}

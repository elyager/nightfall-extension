import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  luminance,
  parseRgb,
  transformBackground,
  transformForeground,
} from '../utils/color';
import {
  GITHUB_DARK,
  LINEAR_DARK,
  SLATE_BLUE,
  themePresets,
} from '../utils/theme';

describe('color conversion', () => {
  it('turns a white surface into a dark surface', () => {
    const white = parseRgb('rgb(255, 255, 255)')!;
    const converted = transformBackground(white);
    expect(luminance(converted)).toBeLessThan(0.08);
  });

  it('guards ordinary text at 4.5:1', () => {
    const background = parseRgb('rgb(20, 22, 27)')!;
    const grayText = parseRgb('rgb(80, 80, 80)')!;
    const converted = transformForeground(
      grayText,
      background,
      4.5,
    );
    expect(contrastRatio(converted, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps all palette backgrounds visually distinct', () => {
    const white = parseRgb('rgb(255, 255, 255)')!;
    const linear = transformBackground(
      white,
      LINEAR_DARK,
      'page',
    );
    const slate = transformBackground(
      white,
      SLATE_BLUE,
      'page',
    );
    const github = transformBackground(white, GITHUB_DARK, 'page');
    expect(new Set([linear, slate, github].map((color) => JSON.stringify(color))).size).toBe(3);
  });

  it('removes purple casts from adapted backgrounds', () => {
    const purple = parseRgb('rgb(128, 40, 190)')!;

    for (const palette of Object.values(themePresets)) {
      const converted = transformBackground(purple, palette);
      expect(converted.r).toBeLessThanOrEqual(converted.g);
    }
  });

  it('does not define purple colors in any theme palette', () => {
    for (const palette of Object.values(themePresets)) {
      for (const value of Object.values(palette)) {
        if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) continue;
        const channels = [1, 3, 5]
          .map((start) => Number.parseInt(value.slice(start, start + 2), 16))
          .join(' ');
        const color = parseRgb(`rgb(${channels})`)!;
        expect(color.r > color.g && color.b > color.g, `${palette.id}: ${value}`).toBe(false);
      }
    }
  });

  it('supports modern CSS rgb syntax', () => {
    expect(parseRgb('rgb(10 20 30 / 0.5)')).toEqual({
      r: 10,
      g: 20,
      b: 30,
      a: 0.5,
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  composite,
  contrastRatio,
  luminance,
  parseHex,
  parseRgb,
  toCss,
  transformBackground,
  transformForeground,
  type Rgb,
} from '../utils/color';
import { DARK_THEME } from '../utils/theme';

const rgb = (value: string) => parseRgb(value)!;
const serialized = (value: Rgb) => rgb(toCss(value));

describe('color parsing', () => {
  it.each([
    ['rgb(10, 20, 30)', { r: 10, g: 20, b: 30, a: 1 }],
    ['rgba(10, 20, 30, .125)', { r: 10, g: 20, b: 30, a: 0.125 }],
    ['rgb(10 20 30 / 50%)', { r: 10, g: 20, b: 30, a: 0.5 }],
    ['rgb(100% 0% 50% / .4)', { r: 255, g: 0, b: 127.5, a: 0.4 }],
    ['color(srgb .2 .4 .6 / 25%)', { r: 51, g: 102, b: 153, a: 0.25 }],
    ['rgb(-20 300 1e2 / 120%)', { r: 0, g: 255, b: 100, a: 1 }],
    ['transparent', { r: 0, g: 0, b: 0, a: 0 }],
  ])('parses %s', (source, expected) => {
    expect(parseRgb(source)).toEqual(expected);
  });

  it.each([
    'rgb(1 2)',
    'rgb(1 2 3 4)',
    'rgb(1, 2, 3 / .5)',
    'rgb(1 2 3 / )',
    'rgb(1 2 3 / .5 / .5)',
    'rgb(NaN 0 0)',
    'prefix rgb(1 2 3)',
    'color(display-p3 1 0 0)',
    'var(--brand)',
  ])('leaves unsupported or invalid input untouched: %s', (source) => {
    expect(parseRgb(source)).toBeNull();
  });

  it('supports short and long hexadecimal alpha', () => {
    expect(parseHex('#f08')).toEqual({ r: 255, g: 0, b: 136, a: 1 });
    expect(parseHex('#f008')).toEqual({ r: 255, g: 0, b: 0, a: 136 / 255 });
    expect(parseHex('#10203040')).toEqual({ r: 16, g: 32, b: 48, a: 64 / 255 });
  });

  it('does not erase small but visible alpha during CSS serialization', () => {
    const value = rgb('rgba(20, 40, 60, 0.004)');
    expect(rgb(toCss(value))).toEqual(value);
  });
});

describe('composited contrast', () => {
  it('matches the standard black-white contrast ratio', () => {
    expect(contrastRatio(rgb('#000'), rgb('#fff'))).toBe(21);
  });

  it('evaluates the displayed translucent foreground instead of opaque RGB', () => {
    const backdrop = rgb('#000');
    const text = rgb('rgb(255 255 255 / .5)');
    expect(composite(text, backdrop)).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
    expect(contrastRatio(text, backdrop)).toBeCloseTo(5.2808, 3);
  });

  it('retains the resulting alpha across transparent layers', () => {
    const result = composite(rgb('rgb(255 0 0 / .5)'), rgb('rgb(0 0 255 / .5)'));
    expect(result).toEqual({ r: 170, g: 0, b: 85, a: 0.75 });
    expect(composite(rgb('transparent'), rgb('transparent'))).toEqual(rgb('transparent'));
  });
});

describe('background adaptation', () => {
  it('maps white surfaces to the single dark palette with readable depth', () => {
    const white = rgb('#fff');
    const page = serialized(transformBackground(white, DARK_THEME, 'page'));
    const surface = serialized(transformBackground(white, DARK_THEME, 'surface'));
    const elevated = serialized(transformBackground(white, DARK_THEME, 'elevated'));
    expect(luminance(page)).toBeLessThan(luminance(surface));
    expect(luminance(surface)).toBeLessThan(luminance(elevated));
    expect(luminance(elevated)).toBeLessThan(0.06);
  });

  it.each(['#000', '#171717', '#29313b', '#300d4d'])('preserves an already-dark authored background: %s', (source) => {
    const color = rgb(source);
    expect(transformBackground(color)).toEqual(color);
  });

  it('retains the source hue including purple instead of removing a channel', () => {
    const color = rgb('rgb(180 70 230)');
    const converted = transformBackground(color);
    expect(luminance(converted)).toBeLessThan(luminance(color));
    expect(converted.b).toBeGreaterThan(converted.r);
    expect(converted.r).toBeGreaterThan(converted.g);
    // Equal mixing/scaling preserves the relative position of the middle channel.
    expect((converted.r - converted.g) / (converted.b - converted.g))
      .toBeCloseTo((color.r - color.g) / (color.b - color.g), 5);
  });

  it('keeps alpha and leaves fully transparent surfaces alone', () => {
    expect(transformBackground(rgb('rgb(250 240 230 / .35)')).a).toBe(0.35);
    const transparent = rgb('rgb(255 255 255 / 0)');
    expect(transformBackground(transparent)).toEqual(transparent);
  });

  it('changes smoothly around colors that previously straddled RGB-sum buckets', () => {
    const below = transformBackground(rgb('rgb(239 240 240)'));
    const above = transformBackground(rgb('rgb(240 240 240)'));
    expect(Math.abs(below.r - above.r)).toBeLessThan(1);
    expect(Math.abs(below.g - above.g)).toBeLessThan(1);
    expect(Math.abs(below.b - above.b)).toBeLessThan(1);
  });

  it('does not progressively darken an already adapted surface', () => {
    const once = transformBackground(rgb('rgb(255 200 60)'));
    expect(transformBackground(once)).toEqual(once);
  });
});

describe('foreground adaptation', () => {
  it.each(['#444', '#7a189e', '#003dad', '#86362e'])('gives %s readable serialized contrast on dark surfaces', (source) => {
    const background = rgb('#171717');
    const converted = serialized(transformForeground(rgb(source), background, 4.5));
    expect(contrastRatio(converted, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('preserves readable authored colors instead of painting every link blue', () => {
    const color = rgb('#d58af0');
    expect(transformForeground(color, rgb('#171717'), 4.5)).toEqual(color);
  });

  it('keeps purple hue when it must lighten an unreadable foreground', () => {
    const converted = transformForeground(rgb('#70109a'), rgb('#171717'), 4.5);
    expect(converted.b).toBeGreaterThan(converted.r);
    expect(converted.r).toBeGreaterThan(converted.g);
    expect(contrastRatio(converted, rgb('#171717'))).toBeGreaterThanOrEqual(4.5);
  });

  it('preserves readable dark text on a retained bright accent', () => {
    const text = rgb('#171717');
    expect(transformForeground(text, rgb('#ffdd44'), 4.5)).toEqual(text);
  });

  it('can darken text to satisfy contrast on a bright accent', () => {
    const background = rgb('#ffdd44');
    const converted = serialized(transformForeground(rgb('#eeeeee'), background, 4.5));
    expect(luminance(converted)).toBeLessThan(0.2);
    expect(contrastRatio(converted, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('honors rendered alpha when reaching a possible contrast target', () => {
    const background = rgb('#171717');
    const converted = serialized(transformForeground(rgb('rgb(70 20 100 / .8)'), background, 4.5));
    expect(converted.a).toBe(0.8);
    expect(contrastRatio(converted, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('preserves intentional transparency when contrast is mathematically impossible', () => {
    const background = rgb('#171717');
    const converted = transformForeground(rgb('rgb(0 0 0 / .1)'), background, 4.5);
    expect(converted).toEqual({ r: 255, g: 255, b: 255, a: 0.1 });
    expect(contrastRatio(converted, background)).toBeLessThan(4.5);
    expect(transformForeground(rgb('transparent'), background, 4.5)).toEqual(rgb('transparent'));
  });

  it('keeps role hierarchy when replacing unreadable neutral text', () => {
    const background = rgb('#171717');
    const primary = transformForeground(rgb('#333'), background, 3, DARK_THEME, 'primary');
    const muted = transformForeground(rgb('#333'), background, 3, DARK_THEME, 'muted');
    expect(luminance(primary)).toBeGreaterThan(luminance(muted));
    expect(contrastRatio(muted, background)).toBeGreaterThanOrEqual(3);
  });
});

import { describe, expect, it } from 'vitest';
import { createBaseCss, shouldPreserveForeground } from '../utils/engine';
import { SLATE_BLUE } from '../utils/theme';

describe('base theme styles', () => {
  it('themes hidden dropdown surfaces before they become visible', () => {
    const css = createBaseCss(SLATE_BLUE);

    expect(css).toContain('html[data-nightfall="active"] .dropdown-menu');
    expect(css).toContain(`background-color: ${SLATE_BLUE.elevatedSurface} !important`);
    expect(css).toContain('html[data-nightfall="active"] .dropdown-item:hover');
    expect(css).toContain(`background-color: ${SLATE_BLUE.controlHover} !important`);
  });

  it('includes persistent element repair overrides', () => {
    const css = createBaseCss(SLATE_BLUE);
    expect(css).toContain('[data-nightfall-repair="true"]');
    expect(css).toContain('background-color: var(--nightfall-element-bg) !important');
  });

  it('preserves foreground colors when an image is reached before a solid surface', () => {
    expect(shouldPreserveForeground([
      { image: 'none', color: { r: 0, g: 0, b: 0, a: 0 } },
      { image: 'url("hero.jpg")', color: { r: 220, g: 230, b: 240, a: 1 } },
    ])).toBe(true);
  });

  it('allows foreground adaptation when an opaque surface covers the image', () => {
    expect(shouldPreserveForeground([
      { image: 'none', color: { r: 30, g: 30, b: 30, a: 1 } },
      { image: 'url("hero.jpg")', color: { r: 220, g: 230, b: 240, a: 1 } },
    ])).toBe(false);
  });

  it('excludes image-backed links and controls from broad foreground rules', () => {
    const css = createBaseCss(SLATE_BLUE);
    expect(css).toContain('a:not(.nightfall-image-backed-text)');
    expect(css).toContain('button:not(.nightfall-image-backed-text)');
    expect(css).toContain('.nightfall-adapted:not(.nightfall-image-backed-text)');
  });
});

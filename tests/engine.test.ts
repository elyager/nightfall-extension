import { describe, expect, it } from 'vitest';
import {
  createBaseCss,
  NIGHTFALL_OBSERVER_OPTIONS,
  shouldPreserveForeground,
} from '../utils/engine';
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

  it('keeps page content visible while adaptive work is queued', () => {
    const css = createBaseCss(SLATE_BLUE);
    expect(css).not.toContain('data-nightfall-pending');
  });

  it('applies each adapted property only to elements explicitly marked for it', () => {
    const css = createBaseCss(SLATE_BLUE);

    expect(css).toContain('.nightfall-adapted-background {');
    expect(css).toContain('.nightfall-adapted-foreground:not(.nightfall-image-backed-text)');
    expect(css).toContain('.nightfall-adapted-border {');
    expect(css).not.toContain('.nightfall-adapted {\n  background-color:');
  });

  it('dims only img elements and composes with their authored filters', () => {
    const css = createBaseCss(SLATE_BLUE, 75);

    expect(css).toContain('--nightfall-image-brightness: 0.75');
    expect(css).toContain('.nightfall-image-brightened');
    expect(css).toContain('var(--nightfall-original-image-filter, brightness(1)) brightness(var(--nightfall-image-brightness, 1))');
    expect(css).toContain('html[data-nightfall="active"] video');
    expect(css).not.toContain('html[data-nightfall="active"] img {\n  filter: none');
    expect(css).not.toContain('img {\n  filter: none');
  });

  it('observes inserted content without tracking attribute churn', () => {
    expect(NIGHTFALL_OBSERVER_OPTIONS).toEqual({
      childList: true,
      subtree: true,
    });
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
    expect(css).toContain('.nightfall-adapted-foreground:not(.nightfall-image-backed-text)');
  });
});

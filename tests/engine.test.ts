import { describe, expect, it } from 'vitest';
import {
  hasSignificantImageOverlayOverlap,
  NIGHTFALL_OBSERVER_OPTIONS,
  shouldPreserveAccentBackground,
  shouldPreserveForeground,
} from '../utils/engine';
import { createBaseCss } from '../utils/engine-styles';
import { contrastRatio, parseHex } from '../utils/color';
import { DARK_THEME } from '../utils/theme';

describe('base theme styles', () => {
  it('themes hidden dropdown surfaces before they become visible', () => {
    const css = createBaseCss(DARK_THEME);

    expect(css).toContain('html[data-nightfall="active"] .dropdown-menu');
    expect(css).toContain(`background-color: ${DARK_THEME.elevatedSurface} !important`);
    expect(css).toContain('html[data-nightfall="active"] .dropdown-item:hover');
    expect(css).toContain(`background-color: ${DARK_THEME.controlHover} !important`);
  });

  it('keeps nested menu labels readable on hover and keyboard focus', () => {
    const css = createBaseCss(DARK_THEME);

    expect(css).toContain('[role="menuitem"]:hover :not(.nightfall-image-backed-text)');
    expect(css).toContain('.dropdown-item:focus :not(.nightfall-image-backed-text)');
    expect(css).toContain(`-webkit-text-fill-color: ${DARK_THEME.textPrimary} !important`);
  });

  it('gives hover surfaces and their text a clearly distinct accessible palette', () => {
    for (const palette of [DARK_THEME]) {
      expect(contrastRatio(parseHex(palette.controlHover), parseHex(palette.controlBackground)))
        .toBeGreaterThanOrEqual(1.5);
      expect(contrastRatio(parseHex(palette.controlHover), parseHex(palette.elevatedSurface)))
        .toBeGreaterThanOrEqual(1.5);
      expect(contrastRatio(parseHex(palette.textPrimary), parseHex(palette.controlHover)))
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it('applies the stronger hover treatment to neutral controls and nested labels', () => {
    const css = createBaseCss(DARK_THEME);

    expect(css).toContain('button:not(.nightfall-accent-background):not(.nightfall-image-backed-text):hover');
    expect(css).toContain('[role="tab"]:not(.nightfall-accent-background):not(.nightfall-image-backed-text):hover');
    expect(css).toContain('[role="option"]:not(.nightfall-accent-background):hover :not(.nightfall-image-backed-text)');
    expect(css).toContain('summary:not(.nightfall-accent-background):focus-visible');
  });

  it('includes persistent element repair overrides', () => {
    const css = createBaseCss(DARK_THEME);
    expect(css).toContain('[data-nightfall-repair="true"]');
    expect(css).toContain('background-color: var(--nightfall-element-bg) !important');
  });

  it('keeps page content visible while adaptive work is queued', () => {
    const css = createBaseCss(DARK_THEME);
    expect(css).not.toContain('data-nightfall-pending');
  });

  it('applies each adapted property only to elements explicitly marked for it', () => {
    const css = createBaseCss(DARK_THEME);

    expect(css).toContain('.nightfall-adapted-background {');
    expect(css).toContain('.nightfall-adapted-foreground:not(.nightfall-image-backed-text)');
    expect(css).toContain('.nightfall-adapted-border {');
    expect(css).not.toContain('.nightfall-adapted {\n  background-color:');
  });

  it('provides a transparent rule for confirmed image overlays', () => {
    const css = createBaseCss(DARK_THEME);

    expect(css).toContain('.nightfall-image-overlay {');
    expect(css).toContain('background-color: transparent !important;');
  });

  it('dims only img elements and composes with their authored filters', () => {
    const css = createBaseCss(DARK_THEME, 75);

    expect(css).toContain('--nightfall-image-brightness: 0.75');
    expect(css).toContain('.nightfall-image-brightened');
    expect(css).toContain('var(--nightfall-original-image-filter, brightness(1)) brightness(var(--nightfall-image-brightness, 1))');
    expect(css).not.toContain('filter: none !important');
    expect(css).not.toContain('mix-blend-mode: normal !important');
    expect(css).not.toContain('html[data-nightfall="active"] img {\n  filter: none');
    expect(css).not.toContain('img {\n  filter: none');
  });

  it('observes inserted content and authored appearance changes', () => {
    expect(NIGHTFALL_OBSERVER_OPTIONS).toEqual({
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'open', 'disabled', 'aria-expanded', 'aria-selected'],
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
    const css = createBaseCss(DARK_THEME);
    expect(css).toContain('a:not(.nightfall-image-backed-text)');
    expect(css).not.toContain('button:not(.nightfall-image-backed-text)');
    expect(css).toContain('.nightfall-adapted-foreground:not(.nightfall-image-backed-text)');
  });

  it('does not flatten authored button backgrounds in the base stylesheet', () => {
    const css = createBaseCss(DARK_THEME);

    expect(css).not.toContain('html[data-nightfall="active"] button {');
    expect(css).not.toContain('html[data-nightfall="active"] button:hover');
    expect(css).not.toContain('html[data-nightfall="active"] button:active');
  });

  it('preserves distinctive colors on controls and information capsules', () => {
    const accent = { r: 20, g: 115, b: 230, a: 1 };

    expect(shouldPreserveAccentBackground(accent, {
      interactive: true,
      badgeLike: false,
    })).toBe(true);
    expect(shouldPreserveAccentBackground(accent, {
      interactive: false,
      badgeLike: true,
    })).toBe(true);
  });

  it('continues adapting neutral controls and non-semantic colored surfaces', () => {
    expect(shouldPreserveAccentBackground(
      { r: 42, g: 46, b: 52, a: 1 },
      { interactive: true, badgeLike: false },
    )).toBe(false);
    expect(shouldPreserveAccentBackground(
      { r: 20, g: 115, b: 230, a: 1 },
      { interactive: false, badgeLike: false },
    )).toBe(false);
  });

  it('requires meaningful overlap before treating a layer as an image overlay', () => {
    expect(hasSignificantImageOverlayOverlap(
      { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
      { left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 },
    )).toBe(true);
    expect(hasSignificantImageOverlayOverlap(
      { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
      { left: 80, top: 80, right: 180, bottom: 180, width: 100, height: 100 },
    )).toBe(false);
  });
});

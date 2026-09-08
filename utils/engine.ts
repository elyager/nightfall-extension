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
} from './color';
import {
  getSiteSettings,
  loadSettings,
  type NightfallSettings,
  type PerformanceStatus,
} from './settings';
import {
  getThemePreset,
  type SurfaceLevel,
  type TextRole,
  type ThemePalette,
} from './theme';
import { detectNativeDark } from './native-dark';
import { createBaseCss } from './engine-styles';
import { pagePath, repairsForPath } from './repairs';
import { collectPageStyleSnapshot, type PageStyleSnapshot } from './ai-theme';
import { clearComputedColorCache, parseComputedColor } from './css-color';

const BOOTSTRAP_ID = 'nightfall-bootstrap';
const STYLE_ID = 'nightfall-styles';
const BATCH_SIZE = 80;
const MEDIA_SELECTOR = 'img, video, canvas, picture, iframe, object, embed, svg';
const IMAGE_BACKED_TEXT_CLASS = 'nightfall-image-backed-text';
const IMAGE_OVERLAY_CLASS = 'nightfall-image-overlay';
const IMAGE_BRIGHTNESS_CLASS = 'nightfall-image-brightened';
const ADAPTED_BACKGROUND_CLASS = 'nightfall-adapted-background';
const ADAPTED_FOREGROUND_CLASS = 'nightfall-adapted-foreground';
const ADAPTED_BORDER_CLASS = 'nightfall-adapted-border';
const ACCENT_BACKGROUND_CLASS = 'nightfall-accent-background';
const IMAGE_OVERLAY_CONTAINER_SELECTOR = '[data-dram-node-role="PainterContentContainer"]';

export const NIGHTFALL_OBSERVER_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'style', 'hidden', 'open', 'disabled', 'aria-expanded', 'aria-selected'],
};

interface BackgroundLayer {
  image: string;
  color: Rgb | null;
}

interface StyleSnapshot {
  display: string;
  visibility: string;
  backgroundColor: string;
  color: string;
  borderTopColor: string;
  backgroundImage: string;
  boxShadow: string;
  position: string;
  fontSize: string;
  fontWeight: string;
  borderRadius: string;
  filter: string;
  opacity: string;
}

type StyleCache = WeakMap<HTMLElement, StyleSnapshot>;
type ImageCache = WeakMap<Element, HTMLImageElement[]>;

interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface AccentBackgroundContext {
  interactive: boolean;
  badgeLike: boolean;
}

export function shouldPreserveForeground(layers: BackgroundLayer[]): boolean {
  for (const layer of layers) {
    if (layer.image !== 'none') return true;
    if (layer.color && layer.color.a > 0.65) return false;
  }
  return false;
}

export function shouldPreserveAccentBackground(
  color: Rgb | null,
  context: AccentBackgroundContext,
): boolean {
  if (!color || color.a <= 0.65 || (!context.interactive && !context.badgeLike)) {
    return false;
  }

  const strongestChannel = Math.max(color.r, color.g, color.b);
  const weakestChannel = Math.min(color.r, color.g, color.b);
  const chroma = strongestChannel - weakestChannel;
  const saturation = chroma / Math.max(strongestChannel, 1);
  return chroma >= 36 && saturation >= 0.28;
}

export function hasSignificantImageOverlayOverlap(
  overlayRect: RectLike,
  imageRect: RectLike,
): boolean {
  const left = Math.max(overlayRect.left, imageRect.left);
  const top = Math.max(overlayRect.top, imageRect.top);
  const right = Math.min(overlayRect.right, imageRect.right);
  const bottom = Math.min(overlayRect.bottom, imageRect.bottom);
  const intersectionArea = Math.max(0, right - left) * Math.max(0, bottom - top);
  const overlayArea = Math.max(0, overlayRect.width * overlayRect.height);
  const imageArea = Math.max(0, imageRect.width * imageRect.height);

  if (intersectionArea === 0 || overlayArea === 0 || imageArea === 0) {
    return false;
  }

  // Require most of the candidate overlay to sit over the image, while still
  // allowing the image to be slightly smaller than its containing layer.
  return intersectionArea / overlayArea >= 0.5 && intersectionArea / imageArea >= 0.25;
}


function removeBootstrap(): void {
  document.getElementById(BOOTSTRAP_ID)?.remove();
  document.documentElement.dataset.nightfallBootstrap = 'off';
}

function isLargeText(style: StyleSnapshot): boolean {
  const size = Number.parseFloat(style.fontSize);
  const weight = Number.parseInt(style.fontWeight, 10) || 400;
  return size >= 24 || (size >= 18.66 && weight >= 700);
}

function isExtensionElement(element: Element): boolean {
  return element.id.startsWith('nightfall-');
}

function waitForBody(): Promise<void> {
  if (document.body) return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    requestAnimationFrame(finish);
    window.setTimeout(finish, 50);
  });
}

export class NightfallEngine {
  private settings!: NightfallSettings;
  private mode: NightfallSettings['mode'] = 'original';
  private readonly hostname = location.hostname;
  private startedAt = performance.now();
  private queueIndex = 0;
  private readonly refreshStyles = () => {
    if (this.adaptive) this.enqueue(document.documentElement);
  };
  private readonly refreshInteraction = (event: Event) => {
    if (!this.adaptive || !(event.target instanceof Element)) return;
    this.enqueue(event.target);
  };
  private observer?: MutationObserver;
  private queue: Element[] = [];
  private queued = new WeakSet<Element>();
  private scheduled = false;
  private adaptive = false;
  private palette!: ThemePalette;
  private generation = 0;
  private colorCache = new Map<string, string>();
  private currentPath = pagePath(location.href);
  private status: PerformanceStatus = {
    mode: 'original',
    active: false,
    nativeDark: false,
    path: 'off',
    startupMs: 0,
    processedNodes: 0,
  };

  async start(settings?: NightfallSettings): Promise<void> {
    const generation = ++this.generation;
    this.startedAt = performance.now();
    const nextSettings = settings ?? (await loadSettings());
    if (generation !== this.generation) return;
    this.settings = nextSettings;
    await waitForBody();
    if (generation !== this.generation) return;
    const site = getSiteSettings(this.settings, this.hostname);
    this.mode = site.mode;
    const shouldRun = site.enabled;
    const switchingPalette =
      shouldRun && site.mode !== 'original' && document.documentElement.dataset.nightfall === 'active';
    // Keep adapted surfaces painted during dark-to-dark switches. The next
    // batch reads through our stylesheet, so it never reuses transformed colors.
    this.teardown(false, switchingPalette);
    this.currentPath = pagePath(location.href);
    const nativeDark = switchingPalette
      ? this.status.nativeDark
      : detectNativeDark();

    if (!site.enabled) {
      removeBootstrap();
      this.status = {
        ...this.emptyStatus('off'),
        nativeDark,
      };
      return;
    }

    if (this.mode === 'original') {
      removeBootstrap();
      this.status = {
        ...this.emptyStatus(nativeDark ? 'native' : 'off'),
        nativeDark,
        startupMs: performance.now() - this.startedAt,
      };
      return;
    }

    removeBootstrap();
    this.palette = getThemePreset(this.mode, site.aiTheme);
    this.installStyles();
    document.documentElement.dataset.nightfall = 'active';
    document.documentElement.dataset.nightfallTheme = this.palette.id;
    this.markStoredRepairs(document.documentElement);
    this.status = {
      ...this.emptyStatus('fast'),
      active: true,
      nativeDark,
      startupMs: performance.now() - this.startedAt,
    };
    this.observe();

    await nextFrame();
    if (generation !== this.generation) return;
    await nextFrame();
    if (generation !== this.generation) return;
    this.enableAdaptive(document.documentElement);
  }

  stop(removeBootstrapLayer = true): void {
    ++this.generation;
    this.teardown(removeBootstrapLayer);
    this.status = this.emptyStatus('off');
  }

  private teardown(removeBootstrapLayer = true, keepAdaptations = false): void {
    document.removeEventListener('load', this.onStylesheetLoad, true);
    window.removeEventListener('resize', this.refreshStyles);
    for (const event of ['pointerover', 'pointerout', 'focusin', 'focusout']) {
      document.removeEventListener(event, this.refreshInteraction, true);
    }
    this.observer?.disconnect();
    this.observer = undefined;
    this.queue = [];
    this.queueIndex = 0;
    this.queued = new WeakSet<Element>();
    this.scheduled = false;
    this.adaptive = false;
    this.colorCache.clear();
    clearComputedColorCache();
    document.documentElement.removeAttribute('data-nightfall');
    document.documentElement.removeAttribute('data-nightfall-theme');
    document.documentElement.removeAttribute('data-nightfall-transition');
    document.getElementById(STYLE_ID)?.remove();
    document.querySelectorAll<HTMLElement>(`.nightfall-adapted, .${IMAGE_BACKED_TEXT_CLASS}, .${IMAGE_OVERLAY_CLASS}, .${IMAGE_BRIGHTNESS_CLASS}`).forEach((element) => {
      if (!keepAdaptations) this.clearAdaptation(element);
    });
    document.querySelectorAll<HTMLElement>('[data-nightfall-repair]').forEach((element) => {
      element.removeAttribute('data-nightfall-repair');
    });
    if (removeBootstrapLayer) removeBootstrap();
  }

  getStatus(): PerformanceStatus {
    return { ...this.status };
  }

  async collectOriginalPageStyleSnapshot(): Promise<PageStyleSnapshot> {
    // Sample synchronously: restoring styles before yielding prevents an AI
    // snapshot from flashing the original page or restarting a disposed engine.
    this.observer?.disconnect();
    try {
      return this.withOriginalStyles(collectPageStyleSnapshot);
    } finally {
      this.observeDocument();
    }
  }

  private withOriginalStyles<T>(read: () => T): T {
    const root = document.documentElement;
    const active = root.getAttribute('data-nightfall');
    const sheet = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    const disabled = sheet?.disabled ?? false;
    if (sheet) sheet.disabled = true;
    root.removeAttribute('data-nightfall');
    try {
      return read();
    } finally {
      if (sheet) sheet.disabled = disabled;
      if (active !== null) root.setAttribute('data-nightfall', active);
    }
  }

  syncNavigation(): void {
    const nextPath = pagePath(location.href);
    if (nextPath === this.currentPath) return;
    this.currentPath = nextPath;
    if (document.documentElement.dataset.nightfall !== 'active') return;

    const affectedElements = new Set(
      document.querySelectorAll<HTMLElement>('[data-nightfall-repair="true"]'),
    );
    affectedElements.forEach((element) => {
      element.removeAttribute('data-nightfall-repair');
    });
    this.markStoredRepairs(document.documentElement);
    document.querySelectorAll<HTMLElement>('[data-nightfall-repair="true"]').forEach((element) => {
      affectedElements.add(element);
    });
    affectedElements.forEach((element) => this.enqueue(element));
  }

  private installStyles(): void {
    const style = document.getElementById(STYLE_ID) ?? document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = createBaseCss(this.palette, this.settings.imageBrightness);
    if (!style.isConnected) document.documentElement.append(style);
  }

  private emptyStatus(path: PerformanceStatus['path']): PerformanceStatus {
    return {
      mode: this.mode,
      active: false,
      nativeDark: false,
      path,
      startupMs: 0,
      processedNodes: 0,
    };
  }

  private readonly onStylesheetLoad = (event: Event) => {
    if (event.target instanceof HTMLLinkElement && event.target.rel === 'stylesheet') {
      this.refreshStyles();
    }
  };

  private observe(): void {
    this.observer = new MutationObserver((mutations) => {
      this.syncNavigation();
      for (const mutation of mutations) {
        const target = mutation.target;
        if (target instanceof Element && isExtensionElement(target)) continue;
        if (target instanceof HTMLStyleElement) {
          this.refreshStyles();
          continue;
        }
        if (mutation.type === 'attributes' && target instanceof Element) {
          if (this.adaptive) this.enqueue(target);
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element) || isExtensionElement(node)) continue;
          this.markStoredRepairs(node);
          if (node instanceof HTMLStyleElement) this.refreshStyles();
          else if (this.adaptive) this.enqueue(node);
        }
      }
    });
    this.observeDocument();
    document.addEventListener('load', this.onStylesheetLoad, true);
    window.addEventListener('resize', this.refreshStyles);
    for (const event of ['pointerover', 'pointerout', 'focusin', 'focusout']) {
      document.addEventListener(event, this.refreshInteraction, true);
    }
  }

  private observeDocument(): void {
    this.observer?.observe(document.documentElement, NIGHTFALL_OBSERVER_OPTIONS);
  }

  private enableAdaptive(root: Element): void {
    this.adaptive = true;
    this.status.path = 'adaptive';
    this.enqueue(root, true);
  }

  private enqueue(element: Element, immediate = false): void {
    if (this.queued.has(element) || isExtensionElement(element)) return;
    this.queued.add(element);
    this.queue.push(element);
    if (this.adaptive) this.scheduleBatch(immediate);
  }

  private scheduleBatch(immediate = false): void {
    if (this.scheduled) return;
    this.scheduled = true;
    const generation = this.generation;
    const run = () => {
      if (generation !== this.generation) return;
      this.scheduled = false;
      if (!this.adaptive) return;
      this.processBatch();
    };
    if (immediate) queueMicrotask(run);
    else if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 120 });
    else setTimeout(run, 16);
  }

  private processBatch(): void {
    const observer = this.observer;
    const styleCache: StyleCache = new WeakMap();
    const imageCache: ImageCache = new WeakMap();
    const elements: Element[] = [];
    observer?.disconnect();
    try {
      // A queue cursor avoids repeatedly shifting every remaining DOM node.
      while (this.queueIndex < this.queue.length && elements.length < BATCH_SIZE) {
        const element = this.queue[this.queueIndex++]!;
        this.queued.delete(element);
        if (!element.isConnected || isExtensionElement(element)) continue;
        elements.push(element);
        for (const child of element.children) {
          if (!this.queued.has(child) && !isExtensionElement(child)) {
            this.queued.add(child);
            this.queue.push(child);
          }
        }
      }
      // Read authored colors in one synchronous phase. Otherwise a previously
      // adapted parent (or our base link/input CSS) contaminates the next read.
      this.withOriginalStyles(() => {
        for (const element of elements) {
          let current = element instanceof HTMLElement ? element : element.parentElement;
          while (current && !styleCache.has(current)) {
            this.readStyle(current, styleCache);
            current = current.parentElement;
          }
        }
      });
      for (const element of elements) this.processElement(element, styleCache, imageCache);
    } finally {
      if (observer && this.observer === observer) this.observeDocument();
    }
    this.status.processedNodes += elements.length;
    if (this.queueIndex < this.queue.length) this.scheduleBatch();
    else {
      this.queue = [];
      this.queueIndex = 0;
    }
  }

  private processElement(
    element: Element,
    styleCache: StyleCache,
    imageCache: ImageCache,
  ): void {
    if (element instanceof HTMLImageElement) {
      this.adaptImageBrightness(element, styleCache);
      return;
    }
    if (
      !(element instanceof HTMLElement) ||
      element.matches(MEDIA_SELECTOR) ||
      isExtensionElement(element)
    ) {
      return;
    }

    this.clearAdaptation(element);
    const style = this.readStyle(element, styleCache);
    // Hidden menus and tooltips also need colors before CSS-only hover reveals.

    const background = parseRgb(style.backgroundColor);
    const forced = element.getAttribute('data-nightfall-repair') === 'true';
    const imageOverlay = !forced && this.isImageOverlay(
      element,
      style,
      background,
      styleCache,
      imageCache,
    );
    if (imageOverlay) element.classList.add(IMAGE_OVERLAY_CLASS);
    const preserveForeground = imageOverlay || this.isOverBackgroundImage(
      element,
      style,
      background,
      styleCache,
    );
    if (preserveForeground) {
      element.classList.add(IMAGE_BACKED_TEXT_CLASS);
      element.style.setProperty('--nightfall-original-fg', style.color);
    }

    const foreground = parseRgb(style.color);
    const border = parseRgb(style.borderTopColor);
    const hasImage = style.backgroundImage !== 'none';
    let transformedBackground: Rgb | null = null;
    const level = this.classifySurface(element, style, background);
    const preserveAccentBackground = shouldPreserveAccentBackground(background, {
      interactive: this.isInteractive(element),
      badgeLike: this.isBadgeLike(element, style),
    });
    element.classList.toggle(ACCENT_BACKGROUND_CLASS, preserveAccentBackground);

    if (forced) {
      const forcedBackground = this.surfaceColor(level);
      element.style.setProperty('--nightfall-element-bg', forcedBackground);
      transformedBackground = parseHex(forcedBackground);
    } else if (preserveAccentBackground) {
      // Keep authored accent fills (including their hover/active states) under
      // site control. Retain the color locally so foreground contrast is still
      // checked against the actual accent rather than an ancestor surface.
      transformedBackground = background;
    } else if (!imageOverlay && background && background.a > 0 && !hasImage) {
      const key = `bg:${this.palette.id}:${level}:${style.backgroundColor}`;
      const value = this.cachedColor(key, () => {
        transformedBackground = transformBackground(
          background,
          this.palette,
          level,
        );
        return toCss(transformedBackground);
      });
      transformedBackground ??= parseRgb(value);
      element.style.setProperty('--nightfall-element-bg', value);
    }

    const parentBackground = this.findEffectiveBackground(element.parentElement, styleCache);
    const effectiveBackground = transformedBackground
      ? composite(transformedBackground, parentBackground)
      : parentBackground;
    if (forced) {
      element.style.setProperty('--nightfall-element-fg', this.palette.textPrimary);
    } else if (!preserveForeground && foreground && (transformedBackground || contrastRatio(foreground, effectiveBackground) < 4.5)) {
      const minimum = isLargeText(style) ? 3 : 4.5;
      const role = this.classifyText(element, style, foreground);
      const key = `fg:${this.palette.id}:${role}:${style.color}:${toCss(effectiveBackground)}:${minimum}`;
      const value = this.cachedColor(key, () =>
        toCss(
          transformForeground(
            foreground,
            effectiveBackground,
            minimum,
            this.palette,
            role,
          ),
        ),
      );
      element.style.setProperty('--nightfall-element-fg', value);
    }

    if (forced) {
      element.style.setProperty('--nightfall-element-border', this.palette.border);
    } else if (!preserveAccentBackground && border && border.a > 0.2) {
      const visibleBoundary = this.isInteractive(element) || level === 'elevated' || level === 'overlay';
      element.style.setProperty(
        '--nightfall-element-border',
        visibleBoundary ? this.palette.border : this.palette.borderSubtle,
      );
    }

    const hasAdaptedBackground = Boolean(
      element.style.getPropertyValue('--nightfall-element-bg'),
    );
    const hasAdaptedForeground = Boolean(
      element.style.getPropertyValue('--nightfall-element-fg'),
    );
    const hasAdaptedBorder = Boolean(
      element.style.getPropertyValue('--nightfall-element-border'),
    );
    element.classList.toggle(ADAPTED_BACKGROUND_CLASS, hasAdaptedBackground);
    element.classList.toggle(ADAPTED_FOREGROUND_CLASS, hasAdaptedForeground);
    element.classList.toggle(ADAPTED_BORDER_CLASS, hasAdaptedBorder);

    if (hasAdaptedBackground || hasAdaptedForeground || hasAdaptedBorder) {
      element.classList.add('nightfall-adapted');
    }
  }

  private cachedColor(key: string, create: () => string): string {
    const cached = this.colorCache.get(key);
    if (cached) return cached;
    const value = create();
    if (this.colorCache.size >= 4096) this.colorCache.clear();
    this.colorCache.set(key, value);
    return value;
  }

  private surfaceColor(level: SurfaceLevel): string {
    if (level === 'page') return this.palette.pageBackground;
    if (level === 'elevated' || level === 'overlay') return this.palette.elevatedSurface;
    if (level === 'interactive') return this.palette.controlBackground;
    return this.palette.surface;
  }

  private markStoredRepairs(root: Element): void {
    if (!this.settings) return;
    const repairs = repairsForPath(
      getSiteSettings(this.settings, this.hostname).repairs,
      this.currentPath,
    );
    for (const repair of repairs) {
      try {
        if (root.matches(repair.selector)) root.setAttribute('data-nightfall-repair', 'true');
        root.querySelectorAll(repair.selector).forEach((element) => {
          element.setAttribute('data-nightfall-repair', 'true');
        });
      } catch {
        // Ignore selectors that became invalid after a browser update or migration.
      }
    }
  }

  private readStyle(element: HTMLElement, styleCache: StyleCache): StyleSnapshot {
    const cached = styleCache.get(element);
    if (cached) return cached;

    const style = getComputedStyle(element);
    const normalizedColor = (value: string) => {
      const color = parseComputedColor(value);
      return color ? toCss(color) : value;
    };
    const snapshot: StyleSnapshot = {
      display: style.display,
      visibility: style.visibility,
      backgroundColor: normalizedColor(style.backgroundColor),
      color: normalizedColor(style.color),
      borderTopColor: normalizedColor(style.borderTopColor),
      backgroundImage: style.backgroundImage,
      boxShadow: style.boxShadow,
      position: style.position,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      borderRadius: style.borderRadius,
      filter: style.filter,
      opacity: style.opacity,
    };
    styleCache.set(element, snapshot);
    return snapshot;
  }

  private findEffectiveBackground(
    element: HTMLElement | null,
    styleCache: StyleCache,
  ): Rgb {
    const layers: Rgb[] = [];
    let current = element;
    while (current) {
      if (!current.classList.contains(IMAGE_OVERLAY_CLASS)) {
        const style = this.readStyle(current, styleCache);
        const original = parseRgb(style.backgroundColor);
        const adapted = parseRgb(current.style.getPropertyValue('--nightfall-element-bg'));
        if (adapted || (original && original.a > 0)) {
          const preserved = current.classList.contains(ACCENT_BACKGROUND_CLASS) || style.backgroundImage !== 'none';
          const color = adapted ?? (preserved ? original! : transformBackground(
            original!, this.palette, this.classifySurface(current, style, original),
          ));
          layers.push(color);
          if (color.a >= 1) break;
        }
      }
      current = current.parentElement;
    }
    return layers.reverse().reduce((background, layer) => composite(layer, background),
      parseHex(this.palette.pageBackground));
  }

  private isOverBackgroundImage(
    element: HTMLElement,
    style: StyleSnapshot,
    background: Rgb | null,
    styleCache: StyleCache,
  ): boolean {
    if (element.closest(`.${IMAGE_OVERLAY_CLASS}`)) return true;

    // The first background image or opaque color in the ancestor chain decides
    // the result. The previous implementation scanned the complete chain even
    // after the answer was known, and then scanned it again for the effective
    // background.
    if (style.backgroundImage !== 'none') return true;
    if (background && background.a > 0.65) {
      return false;
    }

    let current = element.parentElement;
    while (current) {
      const ancestorStyle = this.readStyle(current, styleCache);
      if (ancestorStyle.backgroundImage !== 'none') return true;
      const ancestorBackground = parseRgb(ancestorStyle.backgroundColor);
      if (ancestorBackground && ancestorBackground.a > 0.65) {
        return false;
      }
      current = current.parentElement;
    }
    return false;
  }

  private isImageOverlay(
    element: HTMLElement,
    style: StyleSnapshot,
    background: Rgb | null,
    styleCache: StyleCache,
    imageCache: ImageCache,
  ): boolean {
    if (
      element.localName !== 'div' ||
      !background ||
      background.a <= 0.65 ||
      style.backgroundImage !== 'none' ||
      style.opacity !== '1' ||
      this.isInteractive(element) ||
      element.matches('dialog, [role="dialog"], [role="menu"], [role="listbox"], [popover]') ||
      style.boxShadow !== 'none'
    ) {
      return false;
    }

    const container = this.findImageOverlayContainer(element, styleCache);
    if (!container) return false;
    if (
      style.position === 'static' &&
      !container.matches(IMAGE_OVERLAY_CONTAINER_SELECTOR)
    ) {
      return false;
    }
    let images = imageCache.get(container);
    if (!images) {
      images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
      imageCache.set(container, images);
    }

    const overlayRect = element.getBoundingClientRect();
    for (const image of images) {
      if (element.contains(image)) continue;

      const imageStyle = getComputedStyle(image);
      if (
        imageStyle.display === 'none' ||
        imageStyle.visibility === 'hidden' ||
        Number.parseFloat(imageStyle.opacity) === 0
      ) {
        continue;
      }

      const imageRect = image.getBoundingClientRect();
      if (!hasSignificantImageOverlayOverlap(overlayRect, imageRect)) continue;
      if (this.isPaintedAboveImage(element, image, overlayRect, imageRect)) {
        return true;
      }
    }
    return false;
  }

  private findImageOverlayContainer(
    element: HTMLElement,
    styleCache: StyleCache,
  ): Element | null {
    const painterContainer = element.closest(IMAGE_OVERLAY_CONTAINER_SELECTOR);
    if (painterContainer) return painterContainer;

    let current = element.parentElement;
    while (current && current !== document.body) {
      const style = this.readStyle(current, styleCache);
      if (style.position !== 'static') return current;
      current = current.parentElement;
    }
    return element.parentElement;
  }

  private isPaintedAboveImage(
    element: HTMLElement,
    image: HTMLImageElement,
    overlayRect: RectLike,
    imageRect: RectLike,
  ): boolean {
    if (typeof document.elementsFromPoint !== 'function') return false;

    const left = Math.max(overlayRect.left, imageRect.left);
    const top = Math.max(overlayRect.top, imageRect.top);
    const right = Math.min(overlayRect.right, imageRect.right);
    const bottom = Math.min(overlayRect.bottom, imageRect.bottom);
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) return false;

    const points: Array<[number, number]> = [
      [left + width * 0.5, top + height * 0.5],
      [left + width * 0.25, top + height * 0.25],
      [left + width * 0.75, top + height * 0.25],
      [left + width * 0.25, top + height * 0.75],
      [left + width * 0.75, top + height * 0.75],
    ];
    let samplesAbove = 0;

    for (const [x, y] of points) {
      const stack = document.elementsFromPoint(x, y);
      const overlayIndex = stack.findIndex((candidate) =>
        candidate === element || element.contains(candidate),
      );
      const imageIndex = stack.indexOf(image);
      if (overlayIndex >= 0 && imageIndex > overlayIndex) samplesAbove += 1;
    }

    return samplesAbove >= 1;
  }

  private clearAdaptation(element: HTMLElement): void {
    element.classList.remove('nightfall-adapted');
    element.classList.remove(ADAPTED_BACKGROUND_CLASS);
    element.classList.remove(ADAPTED_FOREGROUND_CLASS);
    element.classList.remove(ADAPTED_BORDER_CLASS);
    element.classList.remove(ACCENT_BACKGROUND_CLASS);
    element.classList.remove(IMAGE_BACKED_TEXT_CLASS);
    element.classList.remove(IMAGE_OVERLAY_CLASS);
    element.classList.remove(IMAGE_BRIGHTNESS_CLASS);
    element.style.removeProperty('--nightfall-element-bg');
    element.style.removeProperty('--nightfall-element-fg');
    element.style.removeProperty('--nightfall-original-fg');
    element.style.removeProperty('--nightfall-element-border');
    element.style.removeProperty('--nightfall-original-image-filter');
  }

  private adaptImageBrightness(element: HTMLImageElement, styleCache: StyleCache): void {
    this.clearAdaptation(element);
    if (this.settings.imageBrightness === 100) return;
    const authoredFilter = this.readStyle(element, styleCache).filter;
    element.style.setProperty(
      '--nightfall-original-image-filter',
      authoredFilter === 'none' ? 'brightness(1)' : authoredFilter,
    );
    element.classList.add(IMAGE_BRIGHTNESS_CLASS);
  }

  private isInteractive(element: HTMLElement): boolean {
    return element.matches(
      'button, input, textarea, select, option, summary, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="treeitem"], [contenteditable="true"]',
    );
  }

  private isBadgeLike(
    element: HTMLElement,
    style: StyleSnapshot,
  ): boolean {
    if (
      element.matches('mark, output, [role="status"]') ||
      /(?:^|[\s_-])(badge|tag|pill|chip|capsule|label|status|token)(?=$|[\s_-])/i.test(
        element.getAttribute('class') ?? '',
      )
    ) {
      return true;
    }

    const radius = Number.parseFloat(style.borderRadius);
    if (!Number.isFinite(radius) || radius < 6 || !style.display.startsWith('inline')) {
      return false;
    }
    const bounds = element.getBoundingClientRect();
    return bounds.height > 0 && bounds.height <= 80 && bounds.width <= 480;
  }

  private classifySurface(
    element: HTMLElement,
    style: StyleSnapshot,
    background: Rgb | null,
  ): SurfaceLevel {
    if (this.isInteractive(element)) return 'interactive';
    if (
      element.matches('dialog, [role="dialog"], [role="menu"], [role="listbox"], [popover]') ||
      style.position === 'fixed'
    ) {
      return 'overlay';
    }
    if (
      style.boxShadow !== 'none' ||
      element.matches('aside, nav, article, section') ||
      /(?:^|[-_])(card|panel|modal|popover|menu)(?:$|[-_])/i.test(element.className)
    ) {
      return style.boxShadow !== 'none' ? 'elevated' : 'surface';
    }
    if (element.matches('html, body, main') || !background) return 'page';
    const value = luminance(background);
    if (value < 0.75) return 'elevated';
    if (value < 0.9) return 'surface';
    return element.parentElement?.matches('html, body') ? 'page' : 'surface';
  }

  private classifyText(
    element: HTMLElement,
    style: StyleSnapshot,
    foreground: Rgb,
  ): TextRole {
    if (element.matches(':disabled, [aria-disabled="true"]')) return 'disabled';
    if (element.matches('small, time') || foreground.a < 0.68) return 'muted';
    if (Number.parseFloat(style.fontSize) <= 13 || foreground.a < 0.86) return 'secondary';
    return 'primary';
  }

}

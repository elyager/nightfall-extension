import {
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
import { pagePath, repairsForPath } from './repairs';

const BOOTSTRAP_ID = 'nightfall-bootstrap';
const STYLE_ID = 'nightfall-styles';
const BATCH_SIZE = 80;
const MEDIA_SELECTOR = 'img, video, canvas, picture, iframe, object, embed, svg';
const IMAGE_BACKED_TEXT_CLASS = 'nightfall-image-backed-text';

interface BackgroundLayer {
  image: string;
  color: Rgb | null;
}

export function shouldPreserveForeground(layers: BackgroundLayer[]): boolean {
  for (const layer of layers) {
    if (layer.image !== 'none') return true;
    if (layer.color && layer.color.a > 0.65) return false;
  }
  return false;
}

export function createBaseCss(palette: ThemePalette): string {
  return `
html[data-nightfall="active"] {
  color-scheme: dark !important;
  background-color: ${palette.pageBackground} !important;
}
html[data-nightfall="active"] body {
  background-color: transparent !important;
  color: ${palette.textPrimary} !important;
}
html[data-nightfall="active"] input,
html[data-nightfall="active"] textarea,
html[data-nightfall="active"] select,
html[data-nightfall="active"] button {
  background-color: ${palette.controlBackground} !important;
  border-color: ${palette.border} !important;
}
html[data-nightfall="active"] input:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] textarea:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] select:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] button:not(.${IMAGE_BACKED_TEXT_CLASS}) {
  color: ${palette.textPrimary} !important;
}
html[data-nightfall="active"] input:hover,
html[data-nightfall="active"] textarea:hover,
html[data-nightfall="active"] select:hover,
html[data-nightfall="active"] button:hover {
  background-color: ${palette.controlHover} !important;
}
html[data-nightfall="active"] button:active,
html[data-nightfall="active"] [aria-pressed="true"] {
  background-color: ${palette.controlActive} !important;
}
html[data-nightfall="active"] :disabled,
html[data-nightfall="active"] [aria-disabled="true"] {
  background-color: ${palette.controlDisabled} !important;
}
html[data-nightfall="active"] :disabled:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] [aria-disabled="true"]:not(.${IMAGE_BACKED_TEXT_CLASS}) {
  color: ${palette.textDisabled} !important;
}
html[data-nightfall="active"] :focus-visible {
  outline: 2px solid ${palette.focusRing} !important;
  outline-offset: 2px !important;
}
html[data-nightfall="active"] a:not(.${IMAGE_BACKED_TEXT_CLASS}) { color: ${palette.link} !important; }
html[data-nightfall="active"] a:not(.${IMAGE_BACKED_TEXT_CLASS}):hover { color: ${palette.linkHover} !important; text-decoration: underline; }
html[data-nightfall="active"] a:not(.${IMAGE_BACKED_TEXT_CLASS}):visited { color: ${palette.linkVisited} !important; }
html[data-nightfall="active"] ::placeholder { color: ${palette.textMuted} !important; opacity: 1; }
html[data-nightfall="active"] ::selection { background: ${palette.selectionBackground}; color: ${palette.selectionText}; }
html[data-nightfall="active"] dialog,
html[data-nightfall="active"] [role="dialog"],
html[data-nightfall="active"] [role="menu"],
html[data-nightfall="active"] [role="listbox"],
html[data-nightfall="active"] .dropdown-menu,
html[data-nightfall="active"] .sub-menu,
html[data-nightfall="active"] .submenu,
html[data-nightfall="active"] [popover] {
  background-color: ${palette.elevatedSurface} !important;
  color: ${palette.textPrimary} !important;
  border-color: ${palette.border} !important;
  box-shadow: 0 1px 2px ${palette.shadow}, 0 8px 24px ${palette.shadow} !important;
}
html[data-nightfall="active"] [role="menuitem"],
html[data-nightfall="active"] .dropdown-item,
html[data-nightfall="active"] .sub-menu > li > a,
html[data-nightfall="active"] .submenu > li > a {
  background-color: transparent !important;
}
html[data-nightfall="active"] [role="menuitem"]:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] .dropdown-item:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] .sub-menu > li > a:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] .submenu > li > a:not(.${IMAGE_BACKED_TEXT_CLASS}) {
  color: ${palette.textPrimary} !important;
}
html[data-nightfall="active"] [role="menuitem"]:hover,
html[data-nightfall="active"] [role="menuitem"]:focus,
html[data-nightfall="active"] .dropdown-item:hover,
html[data-nightfall="active"] .dropdown-item:focus,
html[data-nightfall="active"] .sub-menu > li > a:hover,
html[data-nightfall="active"] .sub-menu > li > a:focus,
html[data-nightfall="active"] .submenu > li > a:hover,
html[data-nightfall="active"] .submenu > li > a:focus {
  background-color: ${palette.controlHover} !important;
  color: ${palette.textPrimary} !important;
  text-decoration: none;
}
html[data-nightfall="active"] .nightfall-adapted {
  background-color: var(--nightfall-element-bg) !important;
  border-color: var(--nightfall-element-border) !important;
}
html[data-nightfall="active"] .nightfall-adapted:not(.${IMAGE_BACKED_TEXT_CLASS}) {
  color: var(--nightfall-element-fg) !important;
}
html[data-nightfall="active"] [data-nightfall-repair="true"] {
  background-color: var(--nightfall-element-bg) !important;
  color: var(--nightfall-element-fg) !important;
  border-color: var(--nightfall-element-border) !important;
}
html[data-nightfall="active"] ${MEDIA_SELECTOR} {
  filter: none !important;
  mix-blend-mode: normal !important;
}
html[data-nightfall="active"]::-webkit-scrollbar-track { background: ${palette.scrollbarTrack}; }
html[data-nightfall="active"]::-webkit-scrollbar-thumb { background: ${palette.scrollbarThumb}; }
html[data-nightfall="active"]::-webkit-scrollbar-thumb:hover { background: ${palette.scrollbarThumbHover}; }
html[data-nightfall-transition="active"],
html[data-nightfall-transition="active"] body,
html[data-nightfall-transition="active"] .nightfall-adapted,
html[data-nightfall-transition="active"] input,
html[data-nightfall-transition="active"] textarea,
html[data-nightfall-transition="active"] select,
html[data-nightfall-transition="active"] button {
  transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease !important;
}
`;
}

export function installBootstrap(): void {
  const attach = () => {
    if (document.getElementById(BOOTSTRAP_ID)) return true;
    if (!document.documentElement) return false;
    const style = document.createElement('style');
    style.id = BOOTSTRAP_ID;
    style.textContent = `html { background: #16191f !important; color-scheme: dark !important; }`;
    document.documentElement.append(style);
    return true;
  };

  if (attach()) return;
  const observer = new MutationObserver(() => {
    if (attach()) observer.disconnect();
  });
  observer.observe(document, { childList: true });
}

function removeBootstrap(): void {
  document.getElementById(BOOTSTRAP_ID)?.remove();
}

function isLargeText(style: CSSStyleDeclaration): boolean {
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
  private readonly startedAt = performance.now();
  private observer?: MutationObserver;
  private queue: Element[] = [];
  private queued = new WeakSet<Element>();
  private scheduled = false;
  private adaptive = false;
  private palette!: ThemePalette;
  private generation = 0;
  private colorCache = new Map<string, string>();
  private refreshHandle?: number;
  private currentUrl = location.href;
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
    const userInitiated = settings !== undefined;
    const nextSettings = settings ?? (await loadSettings());
    if (generation !== this.generation) return;
    this.settings = nextSettings;
    await waitForBody();
    if (generation !== this.generation) return;
    const site = getSiteSettings(this.settings, this.hostname);
    this.mode = site.mode;
    const shouldRun = site.enabled;
    const switchingPalette =
      shouldRun && document.documentElement.dataset.nightfall === 'active';
    // Tear down the previous palette before reading computed styles for the next
    // one. Keeping the old stylesheet active makes the adaptive pass transform
    // already-transformed colors and also prevents Original from fully restoring
    // the page when this method returns early below.
    this.stop(false);
    this.currentUrl = location.href;
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
    this.palette = getThemePreset(this.mode);
    if (userInitiated && switchingPalette) this.enableTransition();
    this.installStyles();
    document.documentElement.dataset.nightfall = 'active';
    document.documentElement.dataset.nightfallTheme = this.palette.id;
    this.markStoredRepairs(document.documentElement);
    if (userInitiated && !switchingPalette) this.enableTransition();
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
    this.enableAdaptive(document.body);
  }

  stop(removeBootstrapLayer = true): void {
    if (this.refreshHandle !== undefined) {
      window.clearTimeout(this.refreshHandle);
      this.refreshHandle = undefined;
    }
    this.observer?.disconnect();
    this.observer = undefined;
    this.queue = [];
    this.queued = new WeakSet<Element>();
    this.scheduled = false;
    this.adaptive = false;
    this.colorCache.clear();
    document.documentElement.removeAttribute('data-nightfall');
    document.documentElement.removeAttribute('data-nightfall-theme');
    document.documentElement.removeAttribute('data-nightfall-transition');
    document.getElementById(STYLE_ID)?.remove();
    document.querySelectorAll<HTMLElement>(`.nightfall-adapted, .${IMAGE_BACKED_TEXT_CLASS}`).forEach((element) => {
      this.clearAdaptation(element);
    });
    document.querySelectorAll<HTMLElement>('[data-nightfall-repair]').forEach((element) => {
      element.removeAttribute('data-nightfall-repair');
    });
    if (removeBootstrapLayer) removeBootstrap();
  }

  getStatus(): PerformanceStatus {
    return { ...this.status };
  }

  refreshSoon(): void {
    if (this.refreshHandle !== undefined) return;
    this.refreshHandle = window.setTimeout(() => {
      this.refreshHandle = undefined;
      void this.start(this.settings);
    }, 16);
  }

  private installStyles(): void {
    const style = document.getElementById(STYLE_ID) ?? document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = createBaseCss(this.palette);
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

  private enableTransition(): void {
    document.documentElement.dataset.nightfallTransition = 'active';
    window.setTimeout(() => {
      document.documentElement.removeAttribute('data-nightfall-transition');
    }, 180);
  }

  private observe(): void {
    this.observer = new MutationObserver((mutations) => {
      if (location.href !== this.currentUrl) {
        this.currentUrl = location.href;
        this.refreshSoon();
        return;
      }
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (!(target instanceof Element) || isExtensionElement(target)) continue;
          if (this.adaptive) {
            this.enqueue(target, true);
          } else if (this.subtreeNeedsAdaptation(target)) {
            this.enableAdaptive(target);
          }
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element) || isExtensionElement(node)) continue;
          this.markStoredRepairs(node);
          if (!this.adaptive && this.subtreeNeedsAdaptation(node)) {
            this.enableAdaptive(node);
          } else if (this.adaptive) {
            this.enqueue(node, true);
          }
        }
      }
    });
    this.observeDocument();
  }

  private observeDocument(): void {
    this.observer?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'open'],
      childList: true,
      subtree: true,
    });
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
    this.scheduleBatch(immediate);
  }

  private scheduleBatch(immediate = false): void {
    if (this.scheduled) return;
    this.scheduled = true;
    const run = () => {
      this.scheduled = false;
      this.processBatch();
    };
    if (immediate) {
      queueMicrotask(run);
    } else if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 120 });
    } else {
      setTimeout(run, 16);
    }
  }

  private processBatch(): void {
    let count = 0;
    const observer = this.observer;
    observer?.disconnect();
    try {
      while (this.queue.length && count < BATCH_SIZE) {
        const element = this.queue.shift()!;
        this.queued.delete(element);
        this.processElement(element);
        for (const child of element.children) this.enqueue(child);
        count += 1;
      }
    } finally {
      if (observer && this.observer === observer) this.observeDocument();
    }
    this.status.processedNodes += count;
    if (this.queue.length) this.scheduleBatch();
  }

  private elementNeedsAdaptation(element: Element): boolean {
    if (!(element instanceof HTMLElement) || element.matches(MEDIA_SELECTOR)) return false;
    const style = getComputedStyle(element);
    const background = parseRgb(style.backgroundColor);
    return Boolean(
      style.backgroundImage === 'none' &&
      background &&
      background.a > 0.65,
    );
  }

  private subtreeNeedsAdaptation(element: Element): boolean {
    if (this.elementNeedsAdaptation(element)) return true;
    for (const child of element.querySelectorAll('*')) {
      if (this.elementNeedsAdaptation(child)) return true;
    }
    return false;
  }

  private processElement(element: Element): void {
    if (
      !(element instanceof HTMLElement) ||
      element.matches(MEDIA_SELECTOR) ||
      isExtensionElement(element)
    ) {
      return;
    }

    this.clearAdaptation(element);
    let style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return;

    const preserveForeground = this.isOverBackgroundImage(element);
    if (preserveForeground) {
      element.classList.add(IMAGE_BACKED_TEXT_CLASS);
      // Removing Nightfall's broad link/control color rules exposes the
      // page-authored foreground before the rest of this pass reads it.
      style = getComputedStyle(element);
    }

    const background = parseRgb(style.backgroundColor);
    const foreground = parseRgb(style.color);
    const border = parseRgb(style.borderTopColor);
    const hasImage = style.backgroundImage !== 'none';
    let transformedBackground: Rgb | null = null;
    const level = this.classifySurface(element, style, background);
    const forced = element.getAttribute('data-nightfall-repair') === 'true';

    if (forced) {
      const forcedBackground = this.surfaceColor(level);
      element.style.setProperty('--nightfall-element-bg', forcedBackground);
      transformedBackground = parseHex(forcedBackground);
    } else if (background && background.a > 0.65 && !hasImage) {
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

    const effectiveBackground =
      transformedBackground ??
      this.findEffectiveBackground(element.parentElement) ??
      parseHex(this.palette.pageBackground);
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
    } else if (border && border.a > 0.2) {
      const visibleBoundary = this.isInteractive(element) || level === 'elevated' || level === 'overlay';
      element.style.setProperty(
        '--nightfall-element-border',
        visibleBoundary ? this.palette.border : this.palette.borderSubtle,
      );
    }

    if (
      element.style.getPropertyValue('--nightfall-element-bg') ||
      element.style.getPropertyValue('--nightfall-element-fg') ||
      element.style.getPropertyValue('--nightfall-element-border')
    ) {
      element.classList.add('nightfall-adapted');
    }
  }

  private cachedColor(key: string, create: () => string): string {
    const cached = this.colorCache.get(key);
    if (cached) return cached;
    const value = create();
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
      pagePath(location.href),
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

  private findEffectiveBackground(element: HTMLElement | null): Rgb | null {
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
      const color = parseRgb(getComputedStyle(current).backgroundColor);
      if (color && color.a > 0.65) {
        return transformBackground(
          color,
          this.palette,
          this.classifySurface(current, getComputedStyle(current), color),
        );
      }
      current = current.parentElement;
    }
    return null;
  }

  private isOverBackgroundImage(element: HTMLElement): boolean {
    const layers: BackgroundLayer[] = [];
    let current: HTMLElement | null = element;
    while (current) {
      const style = getComputedStyle(current);
      layers.push({
        image: style.backgroundImage,
        color: parseRgb(style.backgroundColor),
      });
      current = current.parentElement;
    }
    return shouldPreserveForeground(layers);
  }

  private clearAdaptation(element: HTMLElement): void {
    element.classList.remove('nightfall-adapted');
    element.classList.remove(IMAGE_BACKED_TEXT_CLASS);
    element.style.removeProperty('--nightfall-element-bg');
    element.style.removeProperty('--nightfall-element-fg');
    element.style.removeProperty('--nightfall-element-border');
  }

  private isInteractive(element: HTMLElement): boolean {
    return element.matches(
      'button, input, textarea, select, option, [role="button"], [role="tab"], [role="menuitem"], [contenteditable="true"]',
    );
  }

  private classifySurface(
    element: HTMLElement,
    style: CSSStyleDeclaration,
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
    style: CSSStyleDeclaration,
    foreground: Rgb,
  ): TextRole {
    if (element.matches(':disabled, [aria-disabled="true"]')) return 'disabled';
    if (element.matches('small, time') || foreground.a < 0.68) return 'muted';
    if (Number.parseFloat(style.fontSize) <= 13 || foreground.a < 0.86) return 'secondary';
    return 'primary';
  }

}

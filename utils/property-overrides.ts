// Also installed at USER origin by the background worker. This beats authored
// inline !important declarations without overwriting the page's inline styles.
export const PROPERTY_OVERRIDES_CSS = `
html[data-nightfall="active"].nightfall-adapted-background,
html[data-nightfall="active"] .nightfall-adapted-background {
  background-color: var(--nightfall-element-bg) !important;
}
html[data-nightfall="active"] .nightfall-adapted-border {
  border-color: var(--nightfall-element-border) !important;
}
html[data-nightfall="active"] .nightfall-adapted-foreground:not(.nightfall-image-backed-text) {
  color: var(--nightfall-element-fg) !important;
  -webkit-text-fill-color: var(--nightfall-element-fg) !important;
}
html[data-nightfall="active"] .nightfall-image-backed-text {
  color: var(--nightfall-original-fg) !important;
  -webkit-text-fill-color: var(--nightfall-original-fg) !important;
}
html[data-nightfall="active"] .nightfall-image-overlay {
  background-color: transparent !important;
}
html[data-nightfall="active"] .nightfall-image-brightened {
  filter: var(--nightfall-original-image-filter, brightness(1)) brightness(var(--nightfall-image-brightness, 1)) !important;
}
html[data-nightfall="active"] :is(button, input, textarea, select, summary, [role="button"], [role="tab"], [role="option"], [role="treeitem"]):not(.nightfall-accent-background):not(.nightfall-image-backed-text):is(:hover, :focus-visible),
html[data-nightfall="active"] :is([role="menuitem"], .dropdown-item, .sub-menu > li > a, .submenu > li > a):not(.nightfall-image-backed-text):is(:hover, :focus) {
  background-color: var(--nightfall-hover-bg) !important;
  color: var(--nightfall-hover-fg) !important;
  -webkit-text-fill-color: var(--nightfall-hover-fg) !important;
}
html[data-nightfall="active"] :is(button, summary, [role="button"], [role="tab"], [role="option"], [role="treeitem"]):not(.nightfall-accent-background):is(:hover, :focus-visible) :not(.nightfall-image-backed-text),
html[data-nightfall="active"] :is([role="menuitem"], .dropdown-item, .sub-menu > li > a, .submenu > li > a):is(:hover, :focus) :not(.nightfall-image-backed-text) {
  color: var(--nightfall-hover-fg) !important;
  -webkit-text-fill-color: var(--nightfall-hover-fg) !important;
}
html[data-nightfall="active"] [data-nightfall-repair="true"] {
  background-color: var(--nightfall-element-bg) !important;
  color: var(--nightfall-element-fg) !important;
  -webkit-text-fill-color: var(--nightfall-element-fg) !important;
  border-color: var(--nightfall-element-border) !important;
}
`;

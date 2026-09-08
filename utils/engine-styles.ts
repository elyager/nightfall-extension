import type { ThemePalette } from './theme';
import { PROPERTY_OVERRIDES_CSS } from './property-overrides';

const IMAGE_BACKED_TEXT_CLASS = 'nightfall-image-backed-text';
const ACCENT_BACKGROUND_CLASS = 'nightfall-accent-background';


export function createBaseCss(
  palette: ThemePalette,
  imageBrightness = 100,
): string {
  return `
html[data-nightfall="active"] {
  color-scheme: dark !important;
  background-color: ${palette.pageBackground} !important;
  --nightfall-image-brightness: ${imageBrightness / 100};
  --nightfall-hover-bg: ${palette.controlHover};
  --nightfall-hover-fg: ${palette.textPrimary};
}
html[data-nightfall="active"] body {
  background-color: transparent !important;
  color: ${palette.textPrimary} !important;
}
html[data-nightfall="active"] input,
html[data-nightfall="active"] textarea,
html[data-nightfall="active"] select {
  background-color: ${palette.controlBackground} !important;
  border-color: ${palette.border} !important;
}
html[data-nightfall="active"] input:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] textarea:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] select:not(.${IMAGE_BACKED_TEXT_CLASS}) {
  color: ${palette.textPrimary} !important;
}
html[data-nightfall="active"] input:hover,
html[data-nightfall="active"] textarea:hover,
html[data-nightfall="active"] select:hover {
  background-color: ${palette.controlHover} !important;
}
html[data-nightfall="active"] input:active,
html[data-nightfall="active"] textarea:active,
html[data-nightfall="active"] select:active {
  background-color: ${palette.controlActive} !important;
}
html[data-nightfall="active"] input:disabled,
html[data-nightfall="active"] textarea:disabled,
html[data-nightfall="active"] select:disabled {
  background-color: ${palette.controlDisabled} !important;
}
html[data-nightfall="active"] input:disabled:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] textarea:disabled:not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] select:disabled:not(.${IMAGE_BACKED_TEXT_CLASS}) {
  color: ${palette.textDisabled} !important;
}
html[data-nightfall="active"] :focus-visible {
  outline: 2px solid ${palette.focusRing} !important;
  outline-offset: 2px !important;
}
html[data-nightfall="active"] a:not(.${IMAGE_BACKED_TEXT_CLASS}):hover { text-decoration: underline; }
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
  -webkit-text-fill-color: ${palette.textPrimary} !important;
  text-decoration: none;
}
html[data-nightfall="active"] button:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):hover,
html[data-nightfall="active"] button:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):focus-visible,
html[data-nightfall="active"] [role="button"]:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):hover,
html[data-nightfall="active"] [role="button"]:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):focus-visible,
html[data-nightfall="active"] [role="tab"]:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):hover,
html[data-nightfall="active"] [role="tab"]:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):focus-visible,
html[data-nightfall="active"] [role="option"]:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):hover,
html[data-nightfall="active"] [role="option"]:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):focus-visible,
html[data-nightfall="active"] [role="treeitem"]:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):hover,
html[data-nightfall="active"] [role="treeitem"]:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):focus-visible,
html[data-nightfall="active"] summary:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):hover,
html[data-nightfall="active"] summary:not(.${ACCENT_BACKGROUND_CLASS}):not(.${IMAGE_BACKED_TEXT_CLASS}):focus-visible {
  background-color: ${palette.controlHover} !important;
  border-color: ${palette.border} !important;
  color: ${palette.textPrimary} !important;
  -webkit-text-fill-color: ${palette.textPrimary} !important;
}
html[data-nightfall="active"] [role="menuitem"]:hover :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] [role="menuitem"]:focus :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] .dropdown-item:hover :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] .dropdown-item:focus :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] .sub-menu > li > a:hover :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] .sub-menu > li > a:focus :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] .submenu > li > a:hover :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] .submenu > li > a:focus :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] button:not(.${ACCENT_BACKGROUND_CLASS}):hover :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] button:not(.${ACCENT_BACKGROUND_CLASS}):focus-visible :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] [role="button"]:not(.${ACCENT_BACKGROUND_CLASS}):hover :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] [role="button"]:not(.${ACCENT_BACKGROUND_CLASS}):focus-visible :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] [role="tab"]:not(.${ACCENT_BACKGROUND_CLASS}):hover :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] [role="tab"]:not(.${ACCENT_BACKGROUND_CLASS}):focus-visible :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] [role="option"]:not(.${ACCENT_BACKGROUND_CLASS}):hover :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] [role="option"]:not(.${ACCENT_BACKGROUND_CLASS}):focus-visible :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] [role="treeitem"]:not(.${ACCENT_BACKGROUND_CLASS}):hover :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] [role="treeitem"]:not(.${ACCENT_BACKGROUND_CLASS}):focus-visible :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] summary:not(.${ACCENT_BACKGROUND_CLASS}):hover :not(.${IMAGE_BACKED_TEXT_CLASS}),
html[data-nightfall="active"] summary:not(.${ACCENT_BACKGROUND_CLASS}):focus-visible :not(.${IMAGE_BACKED_TEXT_CLASS}) {
  color: ${palette.textPrimary} !important;
  -webkit-text-fill-color: ${palette.textPrimary} !important;
}
html[data-nightfall="active"]::-webkit-scrollbar-track { background: ${palette.scrollbarTrack}; }
html[data-nightfall="active"]::-webkit-scrollbar-thumb { background: ${palette.scrollbarThumb}; }
html[data-nightfall="active"]::-webkit-scrollbar-thumb:hover { background: ${palette.scrollbarThumbHover}; }
${PROPERTY_OVERRIDES_CSS}
`;
}

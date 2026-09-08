export type ThemePreset = 'original' | 'dark' | 'ai';
export type SurfaceLevel =
  | 'page'
  | 'surface'
  | 'elevated'
  | 'interactive'
  | 'overlay';
export type TextRole = 'primary' | 'secondary' | 'muted' | 'disabled';

export interface ThemePalette {
  id: ThemePreset;
  label: string;
  pageBackground: string;
  surface: string;
  elevatedSurface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  border: string;
  borderSubtle: string;
  link: string;
  linkHover: string;
  linkVisited: string;
  controlBackground: string;
  controlHover: string;
  controlActive: string;
  controlDisabled: string;
  focusRing: string;
  selectionBackground: string;
  selectionText: string;
  scrollbarTrack: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
  shadow: string;
  neutralBlend: number;
}

export const DARK_THEME: ThemePalette = {
  id: 'dark',
  label: 'Dark',
  pageBackground: '#101010',
  surface: '#171717',
  elevatedSurface: '#1E1E1E',
  textPrimary: '#F2F2F2',
  textSecondary: '#CCCCCC',
  textMuted: '#8E8E8E',
  textDisabled: '#656565',
  border: '#383838',
  borderSubtle: '#292929',
  link: '#69C8F5',
  linkHover: '#9BE0FF',
  linkVisited: '#B8EAFF',
  controlBackground: '#1B1B1B',
  controlHover: '#3D3D3D',
  controlActive: '#494949',
  controlDisabled: '#151515',
  focusRing: '#69C8F5',
  selectionBackground: '#174C68',
  selectionText: '#FFFFFF',
  scrollbarTrack: '#101010',
  scrollbarThumb: '#383838',
  scrollbarThumbHover: '#505050',
  shadow: 'rgba(0, 0, 0, 0.48)',
  neutralBlend: 0.84,
};

export function getThemePreset(
  theme: ThemePreset,
  generated?: ThemePalette,
): ThemePalette {
  return theme === 'ai' && generated ? generated : DARK_THEME;
}

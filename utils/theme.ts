export type ThemePreset = 'original' | 'slate-blue' | 'linear-dark' | 'github-dark' | 'ai';
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

export const SLATE_BLUE: ThemePalette = {
  id: 'slate-blue',
  label: 'Slate Blue',
  pageBackground: '#10141B',
  surface: '#18202B',
  elevatedSurface: '#202A38',
  textPrimary: '#EDF2F7',
  textSecondary: '#CBD5DF',
  textMuted: '#A9B4C0',
  textDisabled: '#778493',
  border: '#364152',
  borderSubtle: '#293444',
  link: '#7DC4FF',
  linkHover: '#9AD2FF',
  linkVisited: '#A8DFFF',
  controlBackground: '#18202B',
  controlHover: '#233044',
  controlActive: '#2B3A50',
  controlDisabled: '#141A23',
  focusRing: '#7DC4FF',
  selectionBackground: '#234F73',
  selectionText: '#FFFFFF',
  scrollbarTrack: '#10141B',
  scrollbarThumb: '#364152',
  scrollbarThumbHover: '#4A5870',
  shadow: 'rgba(0, 0, 0, 0.42)',
  neutralBlend: 0.78,
};

export const LINEAR_DARK: ThemePalette = {
  id: 'linear-dark',
  label: 'Linear',
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
  controlHover: '#272727',
  controlActive: '#303030',
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

export const GITHUB_DARK: ThemePalette = {
  id: 'github-dark',
  label: 'GitHub',
  pageBackground: '#0D1117',
  surface: '#161B22',
  elevatedSurface: '#21262D',
  textPrimary: '#F0F6FC',
  textSecondary: '#C9D1D9',
  textMuted: '#8B949E',
  textDisabled: '#6E7681',
  border: '#30363D',
  borderSubtle: '#21262D',
  link: '#58A6FF',
  linkHover: '#79C0FF',
  linkVisited: '#A8DFFF',
  controlBackground: '#21262D',
  controlHover: '#30363D',
  controlActive: '#3A424C',
  controlDisabled: '#161B22',
  focusRing: '#1F6FEB',
  selectionBackground: '#264F78',
  selectionText: '#FFFFFF',
  scrollbarTrack: '#0D1117',
  scrollbarThumb: '#30363D',
  scrollbarThumbHover: '#484F58',
  shadow: 'rgba(1, 4, 9, 0.55)',
  neutralBlend: 0.82,
};

export const themePresets: Record<Exclude<ThemePreset, 'ai'>, ThemePalette> = {
  original: SLATE_BLUE,
  'slate-blue': SLATE_BLUE,
  'linear-dark': LINEAR_DARK,
  'github-dark': GITHUB_DARK,
};

export function getThemePreset(
  theme: ThemePreset,
  generated?: ThemePalette,
): ThemePalette {
  if (theme === 'ai') return generated ?? SLATE_BLUE;
  return themePresets[theme];
}

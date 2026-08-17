export const lightColors = {
  background: '#F7F4EF',
  surface: '#FFFFFF',
  surfaceSoft: '#F1EEE8',
  ink: '#172033',
  midnight: '#101827',
  muted: '#667085',
  subtle: '#98A2B3',
  line: '#E5E0D8',
  primary: '#6D5BD0',
  primaryDark: '#5142A5',
  primarySoft: '#EEEAFB',
  lavender: '#C9C1F4',
  warm: '#D99778',
  warmSoft: '#FAEDE6',
  success: '#39745A',
  successSoft: '#E9F3ED',
  warning: '#A15C18',
  warningSoft: '#FFF3DF',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  white: '#FFFFFF',
};

export const darkColors = {
  background: '#0B1320',
  surface: '#131D2B',
  surfaceSoft: '#192536',
  ink: '#F4F1EA',
  midnight: '#202D43',
  muted: '#B2BDCC',
  subtle: '#8793A5',
  line: '#2A3547',
  primary: '#9B8CF2',
  primaryDark: '#B9AEFF',
  primarySoft: '#282247',
  lavender: '#C9C1F4',
  warm: '#E3A07F',
  warmSoft: '#34251F',
  success: '#72C59A',
  successSoft: '#173629',
  warning: '#F4B45E',
  warningSoft: '#392B18',
  danger: '#FF8B83',
  dangerSoft: '#3D211F',
  white: '#FFFFFF',
};

export const themeColors = {
  light: lightColors,
  dark: darkColors,
};

// Compatibilidad temporal para utilidades que no renderizan interfaz.
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};

export const typography = {
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    lineHeight: 18,
  },
};

export const screenPadding = 20;

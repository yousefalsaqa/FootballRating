import type { TextStyle } from 'react-native';

/**
 * Design tokens — the single source of truth for every visual value in the app.
 * Nothing outside `src/ui` should hard-code a color, size, or font.
 */

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

/** Horizontal screen gutter. */
export const gutter = 20;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 999,
} as const;

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const type: Record<
  'display' | 'title' | 'headline' | 'body' | 'secondary' | 'caption' | 'score',
  TextStyle
> = {
  display: {
    fontFamily: fontFamily.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  headline: {
    fontFamily: fontFamily.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
  },
  secondary: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  score: {
    fontFamily: fontFamily.bold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
};

export type TypeVariant = keyof typeof type;

const lightColors: Colors = {
  bg: '#FAFAF9',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F1EE',
  ink: '#111110',
  inkSecondary: '#6F6E69',
  inkTertiary: '#9C9A94',
  hairline: '#E8E7E3',
  /** Primary action: ink-on-bg inverted. */
  actionBg: '#111110',
  actionInk: '#FAFAF9',
  success: '#2E7D4F',
  successBg: '#E4F0E9',
  partial: '#B7791F',
  partialBg: '#F6ECDA',
  danger: '#B3382C',
  dangerBg: '#F6E3E1',
  overlay: 'rgba(17, 17, 16, 0.4)',
};

const darkColors: Colors = {
  bg: '#0E0E0D',
  surface: '#1A1A18',
  surfaceMuted: '#232320',
  ink: '#F2F1EE',
  inkSecondary: '#A3A29C',
  inkTertiary: '#6F6E69',
  hairline: '#26251F',
  actionBg: '#F2F1EE',
  actionInk: '#111110',
  success: '#5FB884',
  successBg: '#17301F',
  partial: '#D9A653',
  partialBg: '#332815',
  danger: '#E07B6F',
  dangerBg: '#361A16',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

export interface Colors {
  bg: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  inkSecondary: string;
  inkTertiary: string;
  hairline: string;
  /** Primary action: ink-on-bg inverted. */
  actionBg: string;
  actionInk: string;
  success: string;
  successBg: string;
  partial: string;
  partialBg: string;
  danger: string;
  dangerBg: string;
  overlay: string;
}

export const palettes = { light: lightColors, dark: darkColors } as const;

export type ColorScheme = keyof typeof palettes;

/** Muted tier tints — desaturated backgrounds with readable ink, per scheme. */
export const tierColors: Record<ColorScheme, Record<'S' | 'A' | 'B' | 'C' | 'D', { bg: string; ink: string }>> = {
  light: {
    S: { bg: '#E4EDF6', ink: '#2B5379' },
    A: { bg: '#E4F0E9', ink: '#2E5F42' },
    B: { bg: '#EFEDDE', ink: '#6B6224' },
    C: { bg: '#F6ECDA', ink: '#8A5E1E' },
    D: { bg: '#F6E3E1', ink: '#8C3A30' },
  },
  dark: {
    S: { bg: '#16283A', ink: '#8FB8DC' },
    A: { bg: '#17301F', ink: '#8CC7A3' },
    B: { bg: '#2E2B14', ink: '#C4B968' },
    C: { bg: '#332815', ink: '#D9A653' },
    D: { bg: '#361A16', ink: '#DE8D82' },
  },
};

/** Single soft shadow, reserved for modals/sheets. Hairlines everywhere else. */
export const modalShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.14,
  shadowRadius: 24,
  elevation: 12,
} as const;

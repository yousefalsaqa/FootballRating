import type { TextStyle } from 'react-native';

/**
 * Design tokens — the single source of truth for every visual value in the app.
 * Nothing outside `src/ui` should hard-code a color, size, or font.
 *
 * Direction: editorial football journalism. Warm newsprint paper, near-black
 * ink, deep navy surfaces, one high-visibility lime accent used sparingly.
 * Flat: hairlines and dense tables over cards; 6–8px radii (avatars excepted).
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
export const gutter = 16;

export const radii = {
  sm: 6,
  md: 8,
  lg: 8,
  full: 999,
} as const;

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  /** Display face — headlines, rank numbers, scores, stamps. */
  condensed: 'BarlowCondensed_700Bold',
} as const;

export const type: Record<
  | 'display'
  | 'title'
  | 'headline'
  | 'body'
  | 'secondary'
  | 'caption'
  | 'kicker'
  | 'rank'
  | 'score'
  | 'stamp',
  TextStyle
> = {
  /** Editorial masthead headings. */
  display: {
    fontFamily: fontFamily.condensed,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: fontFamily.condensed,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  headline: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: 0,
  },
  secondary: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  /** Condensed section labels — "THE RELIABILITY TABLE" kickers. */
  kicker: {
    fontFamily: fontFamily.condensed,
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  /** League-table rank numbers. */
  rank: {
    fontFamily: fontFamily.condensed,
    fontSize: 26,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  /** Reliability scores. */
  score: {
    fontFamily: fontFamily.condensed,
    fontSize: 48,
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  /** Verdict stamps: TRUE / PARTIAL / FALSE. */
  stamp: {
    fontFamily: fontFamily.condensed,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
};

export type TypeVariant = keyof typeof type;

export interface Colors {
  /** Warm newsprint page background. */
  bg: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  inkSecondary: string;
  inkTertiary: string;
  hairline: string;
  /** Deep navy editorial surfaces (podium, tab bar, stat strips). */
  navy: string;
  navyInk: string;
  navyInkSecondary: string;
  navyHairline: string;
  /** High-visibility lime — sparingly: the log-claim action + no.1 rank. */
  accent: string;
  accentInk: string;
  /** Primary action: ink-on-paper inverted. */
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

const lightColors: Colors = {
  bg: '#F3EEE2',
  surface: '#FAF7ED',
  surfaceMuted: '#E9E2CF',
  ink: '#16130E',
  inkSecondary: '#5C564A',
  inkTertiary: '#8D8574',
  hairline: '#D9D1BC',
  navy: '#152A47',
  navyInk: '#F3EEE2',
  navyInkSecondary: '#8FA0BC',
  navyHairline: '#274069',
  accent: '#C6F224',
  accentInk: '#141200',
  actionBg: '#16130E',
  actionInk: '#F3EEE2',
  success: '#1E6B3E',
  successBg: '#DEEBD8',
  partial: '#A26400',
  partialBg: '#F0E2C2',
  danger: '#A8271D',
  dangerBg: '#F0D8D1',
  overlay: 'rgba(22, 19, 14, 0.45)',
};

const darkColors: Colors = {
  bg: '#0B1424',
  surface: '#13223A',
  surfaceMuted: '#1B2C48',
  ink: '#EFEAD9',
  inkSecondary: '#A9A28E',
  inkTertiary: '#777161',
  hairline: '#243756',
  navy: '#13223A',
  navyInk: '#EFEAD9',
  navyInkSecondary: '#8FA0BC',
  navyHairline: '#2A3F63',
  accent: '#C6F224',
  accentInk: '#141200',
  actionBg: '#EFEAD9',
  actionInk: '#16130E',
  success: '#6FBE8B',
  successBg: '#12301E',
  partial: '#D9A653',
  partialBg: '#332815',
  danger: '#DE7A6C',
  dangerBg: '#361713',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

export const palettes = { light: lightColors, dark: darkColors } as const;

export type ColorScheme = keyof typeof palettes;

/** Tier letter tints — muted editorial, readable on both papers. */
export const tierColors: Record<
  ColorScheme,
  Record<'S' | 'A' | 'B' | 'C' | 'D', { bg: string; ink: string }>
> = {
  light: {
    S: { bg: '#152A47', ink: '#C6F224' },
    A: { bg: '#DEEBD8', ink: '#1E5B36' },
    B: { bg: '#E7E4C9', ink: '#5F5A1E' },
    C: { bg: '#F0E2C2', ink: '#7C5312' },
    D: { bg: '#F0D8D1', ink: '#872A20' },
  },
  dark: {
    S: { bg: '#1B2C48', ink: '#C6F224' },
    A: { bg: '#12301E', ink: '#8CC7A3' },
    B: { bg: '#2E2B14', ink: '#C4B968' },
    C: { bg: '#332815', ink: '#D9A653' },
    D: { bg: '#361713', ink: '#DE8D82' },
  },
};

/** Single soft shadow, reserved for modals/sheets. Hairlines everywhere else. */
export const modalShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 16,
  elevation: 8,
} as const;

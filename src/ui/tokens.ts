import type { TextStyle } from 'react-native';

/**
 * Design tokens — the single source of truth for every visual value.
 * Nothing outside `src/ui` should hard-code a color, size, or font.
 *
 * System: THE TRANSFER LEDGER — a football newspaper. Warm paper stock, dark
 * printed ink, black editorial rules, condensed sports numerals, serif body
 * copy. Hierarchy comes from typography, rules, and alignment — not cards,
 * shadows, or rounded containers. Radii are 0–5px; circles are for dots only.
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

/** Horizontal page padding. */
export const gutter = 16;

export const radii = {
  none: 0,
  sm: 3,
  md: 5,
  lg: 5,
  full: 999,
} as const;

/** Newspaper rule weights. */
export const rules = {
  thin: 1,
  medium: 2,
  strong: 4,
} as const;

export const fontFamily = {
  /** Masthead only. */
  masthead: 'PlayfairDisplay_900Black',
  /** Headlines, ranks, scores, section titles. */
  condensed: 'BarlowCondensed_700Bold',
  /** Editorial body copy. */
  serif: 'SourceSerif4_400Regular',
  serifSemibold: 'SourceSerif4_600SemiBold',
  /** Controls and small metadata. */
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const type: Record<
  | 'masthead'
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
  /** THE TRANSFER LEDGER. */
  masthead: {
    fontFamily: fontFamily.masthead,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  /** Lead editorial headlines — "WHO ACTUALLY KNOWS?". */
  display: {
    fontFamily: fontFamily.condensed,
    fontSize: 42,
    lineHeight: 42,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  /** Section titles beside strong rules. */
  title: {
    fontFamily: fontFamily.condensed,
    fontSize: 23,
    lineHeight: 26,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** Claim headlines and journalist names. */
  headline: {
    fontFamily: fontFamily.condensed,
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  /** Editorial body copy. */
  body: {
    fontFamily: fontFamily.serif,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  },
  /** Secondary serif copy — summaries, standfirsts. */
  secondary: {
    fontFamily: fontFamily.serif,
    fontSize: 13.5,
    lineHeight: 19,
    letterSpacing: 0,
  },
  /** Metadata: dates, outlets, labels. */
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  /** Desk labels — "TRANSFER DESK", "REPORTER DOSSIER". */
  kicker: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  /** League-table rank numbers. */
  rank: {
    fontFamily: fontFamily.condensed,
    fontSize: 28,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  /** Reliability scores — the dominant numerals on the page. */
  score: {
    fontFamily: fontFamily.condensed,
    fontSize: 48,
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  /** Verdict stamps: VERIFIED TRUE / REPORT DISPROVED. */
  stamp: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
};

export type TypeVariant = keyof typeof type;

export interface Colors {
  /** Warm newspaper stock. */
  bg: string;
  /** paper-light: selected/elevated editorial sections. */
  surface: string;
  /** paper-dark: pressed states, subtle blocks. */
  surfaceMuted: string;
  ink: string;
  inkSecondary: string;
  inkTertiary: string;
  /** rule-light: thin row separators. */
  hairline: string;
  ruleMedium: string;
  ruleStrong: string;
  /** Primary action: ink-on-paper inverted. */
  actionBg: string;
  actionInk: string;
  /** verified-green — confirmed reports only. */
  success: string;
  successBg: string;
  /** partial-amber — partially confirmed only. */
  partial: string;
  partialBg: string;
  /** editorial-red — disproved reports, urgent emphasis. */
  danger: string;
  dangerBg: string;
  /** developing-blue — unresolved stories. */
  developing: string;
  developingBg: string;
  overlay: string;
}

const lightColors: Colors = {
  bg: '#F1ECDF',
  surface: '#FAF7EF',
  surfaceMuted: '#E4DDCE',
  ink: '#151411',
  inkSecondary: '#33312B',
  inkTertiary: '#6B665C',
  hairline: '#C8C0B1',
  ruleMedium: '#777166',
  ruleStrong: '#1B1A17',
  actionBg: '#151411',
  actionInk: '#F1ECDF',
  success: '#285A3B',
  successBg: '#DFE7DA',
  partial: '#9A651B',
  partialBg: '#EEE2C8',
  danger: '#9F2922',
  dangerBg: '#ECD9D2',
  developing: '#243E5C',
  developingBg: '#DBDFE2',
  overlay: 'rgba(21, 20, 17, 0.45)',
};

/** Night edition: same system printed on dark stock. */
const darkColors: Colors = {
  bg: '#141310',
  surface: '#1C1A15',
  surfaceMuted: '#26231B',
  ink: '#EDE7D6',
  inkSecondary: '#C4BDA9',
  inkTertiary: '#8A8271',
  hairline: '#3A362B',
  ruleMedium: '#5E5847',
  ruleStrong: '#EDE7D6',
  actionBg: '#EDE7D6',
  actionInk: '#151411',
  success: '#7FBF97',
  successBg: '#1C2E22',
  partial: '#D9A653',
  partialBg: '#312816',
  danger: '#E08A7E',
  dangerBg: '#341C17',
  developing: '#8FB0DC',
  developingBg: '#1B2635',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

export const palettes = { light: lightColors, dark: darkColors } as const;

export type ColorScheme = keyof typeof palettes;

/** Single subtle shadow, reserved for modals/sheets. Rules everywhere else. */
export const modalShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 10,
  elevation: 6,
} as const;

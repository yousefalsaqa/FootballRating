import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import {
  gutter,
  modalShadow,
  palettes,
  radii,
  space,
  tierColors,
  type,
  type ColorScheme,
  type Colors,
} from '@/ui/tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: Colors;
  tiers: (typeof tierColors)[ColorScheme];
  space: typeof space;
  radii: typeof radii;
  type: typeof type;
  gutter: number;
  modalShadow: typeof modalShadow;
}

function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: palettes[scheme],
    tiers: tierColors[scheme],
    space,
    radii,
    type,
    gutter,
    modalShadow,
  };
}

const themes: Record<ColorScheme, Theme> = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
};

const ThemeContext = createContext<Theme>(themes.light);

export type ThemePreference = ColorScheme | 'system';

interface ThemeProviderProps {
  children: ReactNode;
  /** User override from settings; 'system' follows the OS. */
  preference: ThemePreference;
}

export function ThemeProvider({ children, preference }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  return <ThemeContext.Provider value={themes[scheme]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Memoized themed StyleSheet builder.
 *
 *   const styles = useThemedStyles((t) => ({ row: { padding: t.space.lg } }));
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  builder: (theme: Theme) => T,
): T {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- builder is expected to be stable per call site
  return useMemo(() => StyleSheet.create(builder(theme)), [theme]);
}

import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/ui/theme';
import type { Colors, TypeVariant } from '@/ui/tokens';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  /** Semantic color name from the palette; defaults to primary ink. */
  color?: keyof Colors;
}

/** The only way text is rendered in the app — enforces the type scale. */
export function Text({ variant = 'body', color = 'ink', style, ...rest }: TextProps) {
  const theme = useTheme();
  return <RNText style={[theme.type[variant], { color: theme.colors[color] }, style]} {...rest} />;
}

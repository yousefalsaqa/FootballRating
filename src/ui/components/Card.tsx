import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/ui/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Thin printed frame — used sparingly; prefer rules and alignment. */
export function Card({ children, style }: CardProps) {
  const { colors, radii, rules, space } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.sm,
          borderWidth: rules.thin,
          borderColor: colors.ruleMedium,
          padding: space.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

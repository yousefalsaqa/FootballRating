import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/ui/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Surface with hairline border — the standard content container. */
export function Card({ children, style }: CardProps) {
  const { colors, radii, space } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: space.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

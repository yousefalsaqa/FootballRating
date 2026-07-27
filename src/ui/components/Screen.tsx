import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/ui/theme';

interface ScreenProps {
  children: ReactNode;
  /** Scrollable content (default) vs fixed layout for screens that own a list. */
  scroll?: boolean;
  /** Extra bottom padding for screens with a floating action button. */
  fabClearance?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Disable horizontal gutters, e.g. for edge-to-edge lists. */
  edgeToEdge?: boolean;
}

/** Base screen container: themed background, safe-area top handled by navigator. */
export function Screen({ children, scroll = true, fabClearance, style, edgeToEdge }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const base: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.bg,
  };
  const padding: ViewStyle = {
    paddingHorizontal: edgeToEdge ? 0 : theme.gutter,
  };
  const bottomPad = insets.bottom + (fabClearance ? 96 : theme.space.xl);

  if (!scroll) {
    return <View style={[base, padding, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={base}
      contentContainerStyle={[padding, { paddingBottom: bottomPad }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}

/** Standard tappable list row: leading slot, title/subtitle, trailing slot. */
export function ListRow({ title, subtitle, leading, trailing, onPress, onLongPress }: ListRowProps) {
  const { colors, space, gutter } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: gutter,
        paddingVertical: space.md,
        minHeight: 56,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="secondary" color="inkSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

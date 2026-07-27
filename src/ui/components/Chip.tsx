import { Pressable } from 'react-native';

import { Text } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

/** Filter/tag chip. */
export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors, radii, space } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: selected ? colors.actionBg : colors.hairline,
        backgroundColor: selected ? colors.actionBg : colors.surface,
        paddingHorizontal: space.lg,
        minHeight: 36,
        justifyContent: 'center',
      }}
    >
      <Text variant="secondary" style={{ color: selected ? colors.actionInk : colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

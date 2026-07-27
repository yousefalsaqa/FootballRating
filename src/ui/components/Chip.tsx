import { Pressable } from 'react-native';

import { Text } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

/** Compact rectangular filter — editorial, not a pill. */
export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors, radii, rules, space } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        borderRadius: radii.sm,
        borderWidth: rules.thin,
        borderColor: selected ? colors.ink : colors.hairline,
        backgroundColor: selected ? colors.actionBg : 'transparent',
        paddingHorizontal: space.md,
        minHeight: 34,
        justifyContent: 'center',
      }}
    >
      <Text variant="caption" style={{ color: selected ? colors.actionInk : colors.inkSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

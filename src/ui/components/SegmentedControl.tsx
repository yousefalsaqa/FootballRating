import { Pressable, View } from 'react-native';

import { Text } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Editorial filter strip: uppercase text, active item carries a dark underline. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors, rules, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space.lg,
        borderBottomWidth: rules.thin,
        borderBottomColor: colors.hairline,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: 40,
              justifyContent: 'center',
              borderBottomWidth: rules.medium,
              borderBottomColor: selected ? colors.ink : 'transparent',
              marginBottom: -rules.thin,
            }}
          >
            <Text variant={selected ? 'stamp' : 'caption'} color={selected ? 'ink' : 'inkTertiary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

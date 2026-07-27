import { View } from 'react-native';

import { Text } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';

interface KeyValueRowProps {
  label: string;
  value: string;
}

/** Label/value line used on detail and review screens. */
export function KeyValueRow({ label, value }: KeyValueRowProps) {
  const { space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: space.lg,
        paddingVertical: space.sm,
      }}
    >
      <Text variant="secondary" color="inkSecondary">
        {label}
      </Text>
      <Text variant="secondary" style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

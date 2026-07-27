import { View } from 'react-native';

import { initialsOf } from '@/lib/format';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

interface JournalistAvatarProps {
  name: string;
  /** Kept in data for future portrait tinting; the frame itself stays ink. */
  color?: string;
  size?: number;
}

/** Square editorial monogram frame — no colored avatar bubbles. */
export function JournalistAvatar({ name, size = 44 }: JournalistAvatarProps) {
  const { colors, rules } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: rules.thin,
        borderColor: colors.ink,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        variant="headline"
        style={{ fontSize: size * 0.42, lineHeight: size * 0.5 }}
        accessibilityElementsHidden
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

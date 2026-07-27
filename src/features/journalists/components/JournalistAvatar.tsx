import { View } from 'react-native';

import { initialsOf } from '@/lib/format';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

interface JournalistAvatarProps {
  name: string;
  color: string;
  size?: number;
}

/** Initials circle — the app's only avatar style. */
export function JournalistAvatar({ name, color, size = 44 }: JournalistAvatarProps) {
  const { radii } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.full,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        variant={size >= 64 ? 'title' : 'headline'}
        style={{ color: '#FFFFFF' }}
        accessibilityElementsHidden
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

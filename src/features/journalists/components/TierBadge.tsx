import { View } from 'react-native';

import type { Tier } from '@/features/scoring/types';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

interface TierBadgeProps {
  tier: Tier | null;
  size?: 'sm' | 'lg';
}

/** Editorial tier classification — bordered type, not a colored game badge. */
export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const { colors, rules, space } = useTheme();
  return (
    <View
      accessibilityLabel={tier ? `${tier} tier` : 'Unranked'}
      style={{
        borderWidth: rules.thin,
        borderColor: tier ? colors.ink : colors.hairline,
        paddingHorizontal: size === 'lg' ? space.sm : 5,
        paddingVertical: size === 'lg' ? 3 : 1,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        variant="stamp"
        color={tier ? 'ink' : 'inkTertiary'}
        style={size === 'lg' ? { fontSize: 13, lineHeight: 17 } : undefined}
      >
        {tier ? `${tier} tier` : 'Unranked'}
      </Text>
    </View>
  );
}

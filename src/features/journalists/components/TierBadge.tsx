import { View } from 'react-native';

import type { Tier } from '@/features/scoring/types';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

interface TierBadgeProps {
  tier: Tier | null;
  size?: 'sm' | 'lg';
}

/** Muted tier chip; renders an outline "–" while unranked. */
export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const { tiers, colors, radii } = useTheme();
  const dimension = size === 'lg' ? 40 : 28;
  const palette = tier ? tiers[tier] : { bg: 'transparent', ink: colors.inkTertiary };
  return (
    <View
      accessibilityLabel={tier ? `Tier ${tier}` : 'Unranked'}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: radii.sm,
        backgroundColor: palette.bg,
        borderWidth: tier ? 0 : 1,
        borderColor: colors.hairline,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant={size === 'lg' ? 'title' : 'headline'} style={{ color: palette.ink }}>
        {tier ?? '–'}
      </Text>
    </View>
  );
}

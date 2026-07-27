import { Pressable, View } from 'react-native';

import type { Claim } from '@/db/schema';
import { ConfidenceDots } from '@/features/claims/components/ConfidenceDots';
import { OutcomePill } from '@/features/claims/components/OutcomePill';
import { formatDate } from '@/lib/format';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

interface ClaimRowProps {
  claim: Claim;
  /** Shown when the list mixes journalists (e.g. the Claims tab). */
  journalistName?: string;
  onPress: () => void;
  onLongPress?: () => void;
}

/** Claim list card: headline, transfer line, meta row. */
export function ClaimRow({ claim, journalistName, onPress, onLongPress }: ClaimRowProps) {
  const { colors, radii, space } = useTheme();
  const transferLine = claim.fromClubName
    ? `${claim.playerName}: ${claim.fromClubName} → ${claim.toClubName}`
    : `${claim.playerName} → ${claim.toClubName}`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.hairline,
        padding: space.lg,
        gap: space.sm,
      })}
    >
      <Text variant="headline" numberOfLines={2}>
        {claim.headline}
      </Text>
      <Text variant="secondary" color="inkSecondary" numberOfLines={1}>
        {transferLine}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: space.xs,
        }}
      >
        <Text variant="caption" color="inkTertiary">
          {journalistName ? `${journalistName} · ` : ''}
          {formatDate(claim.claimedAt)}
        </Text>
        {claim.outcome ? <OutcomePill outcome={claim.outcome} /> : <ConfidenceDots confidence={claim.confidence} />}
      </View>
    </Pressable>
  );
}

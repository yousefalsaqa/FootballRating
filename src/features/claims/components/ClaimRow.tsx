import { Pressable, View } from 'react-native';

import type { Claim } from '@/db/schema';
import { ConfidenceDots } from '@/features/claims/components/ConfidenceDots';
import { VerdictStamp } from '@/features/claims/components/VerdictStamp';
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

/** Wire-style transfer-news entry — dense, divider-separated, no card chrome. */
export function ClaimRow({ claim, journalistName, onPress, onLongPress }: ClaimRowProps) {
  const { colors, space, gutter } = useTheme();
  const transferLine = [
    claim.playerName,
    claim.fromClubName ? `${claim.fromClubName} → ${claim.toClubName}` : `→ ${claim.toClubName}`,
    claim.league ?? undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: space.md,
        paddingHorizontal: gutter,
        paddingVertical: space.md,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="caption" color="inkTertiary">
          {journalistName ? `${journalistName}  ·  ` : ''}
          {formatDate(claim.claimedAt)}
        </Text>
        <Text variant="headline" numberOfLines={2}>
          {claim.headline}
        </Text>
        <Text variant="secondary" color="inkSecondary" numberOfLines={1}>
          {transferLine}
        </Text>
        {claim.outcome === null ? (
          <View style={{ marginTop: 2 }}>
            <ConfidenceDots confidence={claim.confidence} showLabel />
          </View>
        ) : null}
      </View>
      {claim.outcome ? (
        <View style={{ justifyContent: 'center' }}>
          <VerdictStamp outcome={claim.outcome} />
        </View>
      ) : null}
    </Pressable>
  );
}

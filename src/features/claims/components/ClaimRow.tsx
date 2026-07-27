import { Pressable, View } from 'react-native';

import type { Claim } from '@/db/schema';
import { VerdictStamp } from '@/features/claims/components/VerdictStamp';
import { formatDate } from '@/lib/format';
import { Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

interface ClaimRowProps {
  claim: Claim;
  /** Shown when the list mixes journalists (e.g. the Transfer Desk). */
  journalistName?: string;
  onPress: () => void;
  onLongPress?: () => void;
}

/** An archive entry: desk line, headline, facts line, verdict stamp. */
export function ClaimRow({ claim, journalistName, onPress, onLongPress }: ClaimRowProps) {
  const { colors, space, gutter } = useTheme();
  const factsLine = [
    claim.fromClubName ? `${claim.fromClubName} → ${claim.toClubName}` : `→ ${claim.toClubName}`,
    `Confidence ${claim.confidence}/3`,
  ].join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        paddingHorizontal: gutter,
        paddingVertical: space.md,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        gap: 4,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="kicker" color="inkTertiary">
          {journalistName ?? 'Report'}
        </Text>
        <Text variant="caption" color="inkTertiary">
          {formatDate(claim.claimedAt)}
        </Text>
      </View>
      <Text variant="headline" numberOfLines={2}>
        {claim.headline}
      </Text>
      <Text variant="secondary" color="inkSecondary" numberOfLines={1}>
        {claim.playerName}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text variant="caption" color="inkTertiary" numberOfLines={1} style={{ flex: 1, marginRight: space.sm }}>
          {factsLine}
        </Text>
        <VerdictStamp verdict={claim.outcome ?? 'pending'} />
      </View>
    </Pressable>
  );
}

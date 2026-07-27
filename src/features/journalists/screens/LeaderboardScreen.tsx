import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalistAvatar } from '@/features/journalists/components/JournalistAvatar';
import { TierBadge } from '@/features/journalists/components/TierBadge';
import { useRankedJournalists, type RankedJournalist } from '@/features/journalists/hooks';
import { formatScore } from '@/lib/format';
import { EmptyState, ListRow, Screen, Skeleton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

type Row = { kind: 'header'; label: string } | { kind: 'journalist'; journalist: RankedJournalist };

function groupLabel(j: RankedJournalist): string {
  return j.stats.tier ? `${j.stats.tier} tier` : 'Unranked';
}

/** Rankings tab: tier-grouped reliability leaderboard. */
export function LeaderboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useRankedJournalists();

  const rows = useMemo<Row[]>(() => {
    if (!data) {
      return [];
    }
    const result: Row[] = [];
    let lastGroup: string | null = null;
    for (const journalist of data) {
      const label = groupLabel(journalist);
      if (label !== lastGroup) {
        result.push({ kind: 'header', label });
        lastGroup = label;
      }
      result.push({ kind: 'journalist', journalist });
    }
    return result;
  }, [data]);

  return (
    <Screen scroll={false} edgeToEdge>
      {isLoading ? (
        <View style={{ padding: theme.gutter, gap: theme.space.md }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No journalists yet"
          message="Add a journalist to start tracking transfer-claim reliability."
          actionLabel="Add journalist"
          onAction={() => router.push('/journalist/new')}
        />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(row) => (row.kind === 'header' ? `h-${row.label}` : row.journalist.id)}
          getItemType={(row) => row.kind}
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <View
                style={{
                  paddingHorizontal: theme.gutter,
                  paddingTop: theme.space.xl,
                  paddingBottom: theme.space.sm,
                }}
              >
                <Text variant="caption" color="inkTertiary">
                  {item.label}
                </Text>
              </View>
            ) : (
              <ListRow
                title={item.journalist.name}
                subtitle={item.journalist.outlet ?? undefined}
                leading={
                  <JournalistAvatar
                    name={item.journalist.name}
                    color={item.journalist.avatarColor}
                  />
                }
                trailing={
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}
                  >
                    <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatScore(item.journalist.stats.score)}
                    </Text>
                    <TierBadge tier={item.journalist.stats.tier} />
                  </View>
                }
                onPress={() => router.push(`/journalist/${item.journalist.id}`)}
              />
            )
          }
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add claim"
        onPress={() => router.push('/claim/new')}
        style={({ pressed }) => ({
          position: 'absolute',
          right: theme.gutter,
          bottom: insets.bottom + theme.space.xl,
          width: 56,
          height: 56,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.actionBg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          ...theme.modalShadow,
        })}
      >
        <Ionicons name="add" size={28} color={theme.colors.actionInk} />
      </Pressable>
    </Screen>
  );
}

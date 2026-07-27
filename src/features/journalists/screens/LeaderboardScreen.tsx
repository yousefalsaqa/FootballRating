import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalistAvatar } from '@/features/journalists/components/JournalistAvatar';
import { TierBadge } from '@/features/journalists/components/TierBadge';
import { useRankedJournalists, type RankedJournalist } from '@/features/journalists/hooks';
import { formatMovement, formatScore } from '@/lib/format';
import { extractHandleFromUrl } from '@/lib/links';
import { Divider, EmptyState, ListRow, Screen, SearchInput, Skeleton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

interface RankedRow {
  journalist: RankedJournalist;
  rank: number;
}

function MovementText({ movement }: { movement: number }) {
  const rounded = Math.round(movement * 10) / 10;
  const color = rounded > 0 ? 'success' : rounded < 0 ? 'danger' : 'inkTertiary';
  return (
    <Text variant="secondary" color={color} style={{ fontVariant: ['tabular-nums'] }}>
      {formatMovement(movement)}
    </Text>
  );
}

/** One column of the top-three podium strip. */
function PodiumColumn({ row, onPress }: { row: RankedRow; onPress: () => void }) {
  const { colors, space } = useTheme();
  const j = row.journalist;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: space.lg, gap: 2 }}
    >
      <Text variant="rank" style={{ color: row.rank === 1 ? colors.accent : colors.navyInkSecondary, fontSize: 30 }}>
        {row.rank}
      </Text>
      <JournalistAvatar name={j.name} color={j.avatarColor} size={36} />
      <Text
        variant="title"
        style={{ color: colors.navyInk, fontSize: 18, lineHeight: 20, textAlign: 'center' }}
        numberOfLines={1}
      >
        {j.name}
      </Text>
      <Text variant="caption" style={{ color: colors.navyInkSecondary }} numberOfLines={1}>
        {j.outlet ?? '—'}
      </Text>
      <Text variant="score" style={{ color: colors.navyInk, fontSize: 34, lineHeight: 38 }}>
        {formatScore(j.stats.score)}
      </Text>
      <MovementText movement={j.stats.movement} />
    </Pressable>
  );
}

/** A league-table row: rank · identity/record · score/tier/movement. */
function TableRow({ row, onPress }: { row: RankedRow; onPress: () => void }) {
  const { colors, space, gutter } = useTheme();
  const { journalist: j, rank } = row;
  const record = j.stats.record;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: gutter,
        paddingVertical: space.md,
        gap: space.md,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      <Text variant="rank" color="inkTertiary" style={{ width: 34, textAlign: 'center' }}>
        {rank}
      </Text>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="headline" numberOfLines={1}>
          {j.name}
        </Text>
        <Text variant="caption" color="inkTertiary" numberOfLines={1}>
          {j.outlet ?? '—'}
        </Text>
        <Text variant="secondary" color="inkSecondary" style={{ fontVariant: ['tabular-nums'] }}>
          {record.trueCount}–{record.partialCount}–{record.falseCount} · {j.stats.resolvedCount}{' '}
          claim{j.stats.resolvedCount === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text variant="score" style={{ fontSize: 30, lineHeight: 32 }}>
          {formatScore(j.stats.score)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <MovementText movement={j.stats.movement} />
          <TierBadge tier={j.stats.tier} />
        </View>
      </View>
    </Pressable>
  );
}

/** Table tab: "The Reliability Table" — masthead, podium, continuous ranking. */
export function LeaderboardScreen() {
  const router = useRouter();
  const { colors, space, gutter } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useRankedJournalists();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  // A pasted X/Twitter link resolves straight to the journalist by handle.
  const pastedHandle = extractHandleFromUrl(search);
  const handleMatch = pastedHandle
    ? (data ?? []).find((j) => j.handle === pastedHandle)
    : undefined;

  const allRows = useMemo<RankedRow[]>(
    () => (data ?? []).map((journalist, index) => ({ journalist, rank: index + 1 })),
    [data],
  );

  const searching = searchOpen && search.trim().length > 0;
  const filteredRows = useMemo<RankedRow[]>(() => {
    if (!searching || pastedHandle) {
      return allRows;
    }
    const query = search.trim().toLowerCase();
    return allRows.filter(
      ({ journalist: j }) =>
        j.name.toLowerCase().includes(query) ||
        (j.outlet ?? '').toLowerCase().includes(query) ||
        (j.handle ?? '').includes(query.replace(/^@/, '')),
    );
  }, [allRows, searching, pastedHandle, search]);

  const showPodium = !searching && filteredRows.length >= 3;
  const listRows = showPodium ? filteredRows.slice(3) : filteredRows;
  const podium = filteredRows.slice(0, 3);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearch('');
  };

  return (
    <Screen scroll={false} edgeToEdge>
      {/* Masthead */}
      <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: gutter }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text variant="kicker" color="inkTertiary">
              Summer window · 2026
            </Text>
            <Text variant="display">The Reliability Table</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Close search' : 'Search journalists'}
            onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            style={{ padding: space.sm, marginBottom: 2 }}
          >
            <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color={colors.ink} />
          </Pressable>
        </View>
        <Text variant="secondary" color="inkSecondary" style={{ marginTop: 2 }}>
          Journalists ranked by verified transfer claims
        </Text>
        {searchOpen ? (
          <View style={{ marginTop: space.md }}>
            <SearchInput
              placeholder="Name, outlet, or paste an X link…"
              value={search}
              onChangeText={setSearch}
              autoFocus
              accessibilityLabel="Search journalists or paste a link"
            />
            {pastedHandle ? (
              handleMatch ? (
                <ListRow
                  title={handleMatch.name}
                  subtitle={`@${handleMatch.handle} · open scorecard`}
                  leading={<JournalistAvatar name={handleMatch.name} color={handleMatch.avatarColor} size={36} />}
                  trailing={
                    <Text variant="score" style={{ fontSize: 26, lineHeight: 28 }}>
                      {formatScore(handleMatch.stats.score)}
                    </Text>
                  }
                  onPress={() => router.push(`/journalist/${handleMatch.id}`)}
                />
              ) : (
                <View style={{ paddingVertical: space.md, gap: space.xs }}>
                  <Text variant="secondary" color="inkSecondary">
                    No journalist with handle @{pastedHandle} yet.
                  </Text>
                  <Text
                    variant="secondary"
                    color="ink"
                    onPress={() => router.push('/journalist/new')}
                    accessibilityRole="button"
                  >
                    Add them →
                  </Text>
                </View>
              )
            ) : null}
          </View>
        ) : null}
        {/* Newspaper rule under the masthead */}
        <View style={{ height: 2, backgroundColor: colors.ink, marginTop: space.md }} />
      </View>

      {isLoading ? (
        <View style={{ padding: gutter, gap: space.md }}>
          <Skeleton height={120} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : filteredRows.length === 0 && !pastedHandle ? (
        <EmptyState
          title={searching ? 'No matches' : 'No journalists yet'}
          message={
            searching
              ? 'No journalist matches that search.'
              : 'Add a journalist to start tracking transfer-claim reliability.'
          }
          actionLabel="Add journalist"
          onAction={() => router.push('/journalist/new')}
        />
      ) : (
        <>
          {showPodium ? (
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: colors.navy,
                borderBottomWidth: 1,
                borderBottomColor: colors.navyHairline,
              }}
            >
              {podium.map((row, index) => (
                <View key={row.journalist.id} style={{ flex: 1, flexDirection: 'row' }}>
                  {index > 0 ? <View style={{ width: 1, backgroundColor: colors.navyHairline }} /> : null}
                  <PodiumColumn row={row} onPress={() => router.push(`/journalist/${row.journalist.id}`)} />
                </View>
              ))}
            </View>
          ) : null}
          <FlashList
            data={listRows}
            keyExtractor={(row) => row.journalist.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}
            ItemSeparatorComponent={() => <Divider />}
            renderItem={({ item }) => (
              <TableRow row={item} onPress={() => router.push(`/journalist/${item.journalist.id}`)} />
            )}
          />
        </>
      )}

      {/* The one loud element on the page: log a claim. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log claim"
        onPress={() => router.push('/claim/new')}
        style={({ pressed }) => ({
          position: 'absolute',
          right: gutter,
          bottom: insets.bottom + space.lg,
          backgroundColor: colors.accent,
          borderRadius: 8,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text variant="stamp" style={{ color: colors.accentInk, fontSize: 17, lineHeight: 20 }}>
          + Log claim
        </Text>
      </Pressable>
    </Screen>
  );
}

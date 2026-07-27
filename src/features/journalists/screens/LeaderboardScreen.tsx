import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TierBadge } from '@/features/journalists/components/TierBadge';
import { useRankedJournalists, type RankedJournalist } from '@/features/journalists/hooks';
import { formatDate, formatMovement, formatScore } from '@/lib/format';
import { extractHandleFromUrl } from '@/lib/links';
import { Divider, EmptyState, Screen, SearchInput, Skeleton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

interface RankedRow {
  journalist: RankedJournalist;
  rank: number;
}

function surnameOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function recordLine(j: RankedJournalist): string {
  const r = j.stats.record;
  return `${r.trueCount}–${r.partialCount}–${r.falseCount} · ${j.stats.resolvedCount} of ${j.filedCount} resolved`;
}

function MovementText({ movement }: { movement: number }) {
  const rounded = Math.round(movement * 10) / 10;
  const color = rounded > 0 ? 'success' : rounded < 0 ? 'danger' : 'inkTertiary';
  return (
    <Text variant="caption" color={color} style={{ fontVariant: ['tabular-nums'] }}>
      {formatMovement(movement)}
    </Text>
  );
}

/** Lead story: the first-ranked journalist as front-page news. */
function LeadStory({ row, onPress }: { row: RankedRow; onPress: () => void }) {
  const { colors, rules, space, gutter } = useTheme();
  const j = row.journalist;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rank 1, ${j.name}, reliability score ${formatScore(j.stats.score)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: gutter,
        paddingVertical: space.lg,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      <Text variant="kicker" color="danger">
        No. 1 in the reliability table
      </Text>
      <Text variant="display" style={{ marginTop: space.sm, fontSize: 36, lineHeight: 37 }}>
        {surnameOf(j.name)} leads{'\n'}the transfer press
      </Text>
      <Text variant="body" color="inkSecondary" style={{ marginTop: space.sm }}>
        {j.name} holds the highest reliability rating after {j.stats.resolvedCount} resolved
        transfer claim{j.stats.resolvedCount === 1 ? '' : 's'}.
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginTop: space.md,
          borderTopWidth: rules.thin,
          borderTopColor: colors.hairline,
          paddingTop: space.md,
        }}
      >
        <View>
          <Text variant="score" style={{ fontSize: 56, lineHeight: 58 }}>
            {formatScore(j.stats.score)}
          </Text>
          <TierBadge tier={j.stats.tier} size="lg" />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text variant="caption" color="inkSecondary" style={{ fontVariant: ['tabular-nums'] }}>
            {recordLine(j)}
          </Text>
          <MovementText movement={j.stats.movement} />
          <Text variant="caption" color="inkTertiary">
            {j.outlet ?? 'Independent'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Second and third place as secondary stories, side by side. */
function SecondaryStory({ row, onPress }: { row: RankedRow; onPress: () => void }) {
  const { colors, space } = useTheme();
  const j = row.journalist;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rank ${row.rank}, ${j.name}, reliability score ${formatScore(j.stats.score)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: space.md,
        paddingHorizontal: space.md,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        gap: 3,
      })}
    >
      <Text variant="kicker" color="inkTertiary">
        {String(row.rank).padStart(2, '0')}
      </Text>
      <Text variant="headline" numberOfLines={1}>
        {j.name}
      </Text>
      <Text variant="caption" color="inkTertiary" numberOfLines={1}>
        {j.outlet ?? '—'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: 2 }}>
        <Text variant="score" style={{ fontSize: 30, lineHeight: 32 }}>
          {formatScore(j.stats.score)}
        </Text>
        <Text variant="caption" color="inkSecondary">
          {j.stats.tier ? `${j.stats.tier} tier` : 'Unranked'}
        </Text>
      </View>
      <Text variant="caption" color="inkSecondary" style={{ fontVariant: ['tabular-nums'] }}>
        {recordLine(j)}
      </Text>
    </Pressable>
  );
}

/** A reliability-table line: RK · JOURNALIST/RECORD · TREND · RATING · TIER. */
function TableRow({ row, onPress }: { row: RankedRow; onPress: () => void }) {
  const { colors, space, gutter } = useTheme();
  const { journalist: j, rank } = row;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rank ${rank}, ${j.name}, reliability score ${formatScore(j.stats.score)}, ${j.stats.tier ? `${j.stats.tier} tier` : 'unranked'}, ${j.stats.resolvedCount} resolved claims`}
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
      <Text variant="rank" color="inkSecondary" style={{ width: 36 }}>
        {String(rank).padStart(2, '0')}
      </Text>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="headline" numberOfLines={1}>
          {j.name}
        </Text>
        <Text variant="caption" color="inkTertiary" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
          {j.outlet ?? '—'} · {recordLine(j)}
        </Text>
      </View>
      <MovementText movement={j.stats.movement} />
      <View style={{ alignItems: 'flex-end', width: 64 }}>
        <Text variant="score" style={{ fontSize: 28, lineHeight: 30 }}>
          {formatScore(j.stats.score)}
        </Text>
        <Text variant="caption" color="inkSecondary">
          {j.stats.tier ?? '—'}
        </Text>
      </View>
    </Pressable>
  );
}

/** The front page of THE TRANSFER LEDGER. */
export function LeaderboardScreen() {
  const router = useRouter();
  const { colors, rules, space, gutter } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useRankedJournalists();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editionDate] = useState(() => Date.now());

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

  const showFeature = !searching && filteredRows.length >= 3;
  const tableRows = showFeature ? filteredRows.slice(3) : filteredRows;

  const openProfile = (row: RankedRow) => router.push(`/journalist/${row.journalist.id}`);

  const Masthead = (
    <View>
      {/* Edition bar */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: gutter,
          paddingTop: space.sm,
          paddingBottom: space.xs,
        }}
      >
        <Text variant="caption" color="inkSecondary">
          {formatDate(editionDate)}
        </Text>
        <Text variant="caption" color="inkSecondary">
          Summer window · Edition № 1
        </Text>
      </View>
      <Divider />
      {/* Masthead */}
      <View style={{ paddingVertical: space.md, paddingHorizontal: gutter }}>
        <Text variant="masthead">The Transfer Ledger</Text>
        <Text variant="caption" color="inkSecondary" style={{ textAlign: 'center', marginTop: space.xs }}>
          The permanent record of football transfer reporting
        </Text>
      </View>
      <Divider weight="strong" />
      <View style={{ height: 2 }} />
      <Divider />
      {/* Section strip */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.lg,
          paddingHorizontal: gutter,
          minHeight: 44,
        }}
      >
        <Text variant="stamp" color="ink" style={{ textDecorationLine: 'underline' }}>
          Rankings
        </Text>
        <Text
          variant="caption"
          color="inkSecondary"
          accessibilityRole="button"
          onPress={() => router.push('/methodology')}
        >
          Methodology
        </Text>
        <View style={{ flex: 1 }} />
        <Text
          variant="caption"
          color="inkSecondary"
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Close search' : 'Open search'}
          onPress={() => {
            setSearchOpen(!searchOpen);
            setSearch('');
          }}
        >
          {searchOpen ? 'Close ✕' : 'Search'}
        </Text>
        <Text
          variant="stamp"
          color="ink"
          accessibilityRole="button"
          onPress={() => router.push('/claim/new')}
          style={{
            borderWidth: rules.medium,
            borderColor: colors.ink,
            paddingHorizontal: space.sm,
            paddingVertical: 4,
          }}
        >
          File a claim
        </Text>
      </View>
      {searchOpen ? (
        <View style={{ paddingHorizontal: gutter, paddingBottom: space.md }}>
          <SearchInput
            placeholder="Search reporters, or paste an X / Instagram / Snap link…"
            value={search}
            onChangeText={setSearch}
            autoFocus
            accessibilityLabel="Search journalists or paste a social link"
          />
          {pastedHandle ? (
            handleMatch ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/journalist/${handleMatch.id}`)}
                style={{ paddingVertical: space.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <View>
                  <Text variant="headline">{handleMatch.name}</Text>
                  <Text variant="caption" color="inkTertiary">
                    @{handleMatch.handle} · open dossier
                  </Text>
                </View>
                <Text variant="score" style={{ fontSize: 28, lineHeight: 30 }}>
                  {formatScore(handleMatch.stats.score)}
                </Text>
              </Pressable>
            ) : (
              <View style={{ paddingVertical: space.md, gap: space.xs }}>
                <Text variant="secondary" color="inkSecondary">
                  No reporter with handle @{pastedHandle} in the record.
                </Text>
                <Text
                  variant="caption"
                  color="ink"
                  onPress={() => router.push('/journalist/new')}
                  accessibilityRole="button"
                  style={{ textDecorationLine: 'underline' }}
                >
                  Add them →
                </Text>
              </View>
            )
          ) : null}
        </View>
      ) : null}
      <Divider weight="medium" />

      {/* Lead statement */}
      {!searching ? (
        <View style={{ paddingHorizontal: gutter, paddingVertical: space.lg }}>
          <Text variant="display">Who actually{'\n'}knows?</Text>
          <Text variant="body" color="inkSecondary" style={{ marginTop: space.sm }}>
            Football journalists ranked by their verified transfer reporting.
          </Text>
          <Text
            variant="caption"
            color="ink"
            accessibilityRole="button"
            onPress={() => router.push('/methodology')}
            style={{ marginTop: space.sm, textDecorationLine: 'underline' }}
          >
            How the reliability index works →
          </Text>
        </View>
      ) : null}

      {/* Feature: leader + runners-up */}
      {showFeature ? (
        <View>
          <Divider weight="medium" />
          <LeadStory row={filteredRows[0] as RankedRow} onPress={() => openProfile(filteredRows[0] as RankedRow)} />
          <Divider />
          <View style={{ flexDirection: 'row', paddingHorizontal: gutter - space.md }}>
            <SecondaryStory row={filteredRows[1] as RankedRow} onPress={() => openProfile(filteredRows[1] as RankedRow)} />
            <View style={{ width: rules.thin, backgroundColor: colors.hairline }} />
            <SecondaryStory row={filteredRows[2] as RankedRow} onPress={() => openProfile(filteredRows[2] as RankedRow)} />
          </View>
        </View>
      ) : null}

      {/* Table header */}
      {tableRows.length > 0 ? (
        <View>
          <Divider weight="strong" />
          <View style={{ paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: space.sm }}>
            <Text variant="title">The Reliability Table</Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: gutter,
              paddingBottom: space.xs,
              gap: space.md,
            }}
          >
            <Text variant="caption" color="inkTertiary" style={{ width: 36 }}>
              RK
            </Text>
            <Text variant="caption" color="inkTertiary" style={{ flex: 1 }}>
              Journalist
            </Text>
            <Text variant="caption" color="inkTertiary">
              Trend
            </Text>
            <Text variant="caption" color="inkTertiary" style={{ width: 64, textAlign: 'right' }}>
              Rating
            </Text>
          </View>
          <Divider weight="medium" />
        </View>
      ) : null}
    </View>
  );

  const Footer = (
    <View style={{ marginTop: space.xl }}>
      <Divider weight="strong" />
      <View style={{ paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.sm }}>
        <Text variant="title">The Transfer Ledger</Text>
        <Text variant="secondary" color="inkSecondary">
          The permanent record of football transfer reporting.
        </Text>
        <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.xs }}>
          <Text
            variant="caption"
            color="ink"
            accessibilityRole="button"
            onPress={() => router.push('/methodology')}
            style={{ textDecorationLine: 'underline' }}
          >
            Methodology
          </Text>
          <Text
            variant="caption"
            color="ink"
            accessibilityRole="button"
            onPress={() => router.push('/claim/new')}
            style={{ textDecorationLine: 'underline' }}
          >
            Submit a report
          </Text>
        </View>
        <Text variant="secondary" color="inkTertiary" style={{ marginTop: space.xs }}>
          Scores reflect recorded claims and available evidence. Ratings should not be interpreted
          as absolute judgments of character.
        </Text>
      </View>
    </View>
  );

  return (
    <Screen scroll={false} edgeToEdge>
      <View style={{ paddingTop: insets.top }} />
      {isLoading ? (
        <View style={{ padding: gutter, gap: space.md, paddingTop: space.xl }}>
          <Skeleton height={40} width="70%" />
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="85%" />
          <Skeleton height={120} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : filteredRows.length === 0 && !pastedHandle ? (
        <View>
          {Masthead}
          <EmptyState
            title={searching ? 'No matches in the archive' : 'No reporters in this edition'}
            message={
              searching
                ? 'No journalist matches that search.'
                : 'Add a journalist to start building the record.'
            }
            actionLabel="Add journalist"
            onAction={() => router.push('/journalist/new')}
          />
        </View>
      ) : (
        <FlashList
          data={tableRows}
          keyExtractor={(row) => row.journalist.id}
          ListHeaderComponent={Masthead}
          ListFooterComponent={Footer}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.lg }}
          ItemSeparatorComponent={() => <Divider />}
          renderItem={({ item }) => <TableRow row={item} onPress={() => openProfile(item)} />}
        />
      )}
    </Screen>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

import { ClaimRow } from '@/features/claims/components';
import { useClaims } from '@/features/claims/hooks';
import { JournalistAvatar } from '@/features/journalists/components/JournalistAvatar';
import { JournalistScorecard } from '@/features/journalists/components/JournalistScorecard';
import { TierBadge } from '@/features/journalists/components/TierBadge';
import {
  useDeleteJournalist,
  useJournalist,
  useJournalistScorecard,
  useJournalistStats,
  useSetJournalistArchived,
} from '@/features/journalists/hooks';
import { formatAccuracy, formatScore } from '@/lib/format';
import { Button, Divider, EmptyState, Screen, Skeleton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

function RecordLine({ label, value }: { label: string; value: string }) {
  const { space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: space.sm,
      }}
    >
      <Text variant="caption" color="inkSecondary">
        {label}
      </Text>
      <Text variant="headline" style={{ fontVariant: ['tabular-nums'], fontSize: 17, lineHeight: 20 }}>
        {value}
      </Text>
    </View>
  );
}

/** Journalist detail: score hero, stat row, claim history, manage actions. */
export function JournalistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { space, gutter } = useTheme();
  const journalistQuery = useJournalist(id);
  const stats = useJournalistStats(id);
  const scorecard = useJournalistScorecard(id);
  const claimsQuery = useClaims({ journalistId: id });
  const archiveMutation = useSetJournalistArchived();
  const deleteMutation = useDeleteJournalist();

  const journalist = journalistQuery.data;
  if (journalistQuery.isLoading || !stats) {
    return (
      <Screen>
        <View style={{ gap: space.md, paddingTop: space.xl }}>
          <Skeleton height={96} />
          <Skeleton height={64} />
        </View>
      </Screen>
    );
  }
  if (!journalist) {
    return (
      <Screen>
        <EmptyState title="Not found" message="This journalist no longer exists." />
      </Screen>
    );
  }

  const claims = claimsQuery.data ?? [];
  const archived = journalist.archivedAt !== null;

  const confirmDelete = () => {
    Alert.alert(
      'Delete journalist?',
      `This permanently removes ${journalist.name} and all of their claims.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(journalist.id, { onSuccess: () => router.back() });
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={{ paddingVertical: space.lg, gap: space.xs }}>
        <Text variant="kicker" color="danger">
          Reporter dossier
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text variant="display" style={{ fontSize: 34, lineHeight: 35 }}>
              {journalist.name}
            </Text>
            <Text variant="secondary" color="inkSecondary" style={{ marginTop: space.xs }}>
              {journalist.outlet ?? 'Independent'}
              {journalist.handle ? ` · @${journalist.handle}` : ''}
            </Text>
          </View>
          <JournalistAvatar name={journalist.name} size={64} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.lg, marginTop: space.md }}>
          <View>
            <Text variant="caption" color="inkTertiary">
              Reliability
            </Text>
            <Text variant="score" style={{ fontSize: 54, lineHeight: 56 }}>
              {formatScore(stats.score)}
            </Text>
          </View>
          <View style={{ paddingBottom: 6, gap: 4 }}>
            <TierBadge tier={stats.tier} size="lg" />
            {stats.tier === null ? (
              <Text variant="caption" color="inkTertiary">
                {3 - stats.resolvedCount} more to rank
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View>
        <Divider weight="strong" />
        <View style={{ paddingVertical: space.sm }}>
          <Text variant="title" style={{ fontSize: 18, lineHeight: 21 }}>
            Reporting record
          </Text>
        </View>
        <Divider />
        <RecordLine label="True" value={String(stats.record.trueCount)} />
        <Divider />
        <RecordLine label="Partial" value={String(stats.record.partialCount)} />
        <Divider />
        <RecordLine label="False" value={String(stats.record.falseCount)} />
        <Divider />
        <RecordLine label="Developing" value={String(claims.filter((c) => c.status === 'pending').length)} />
        <Divider />
        <RecordLine label="Accuracy" value={formatAccuracy(stats.accuracy)} />
        <Divider />
        <RecordLine label="Streak" value={String(stats.streak)} />
        <Divider weight="medium" />
      </View>

      {scorecard ? (
        <View style={{ marginTop: space.xl }}>
          <JournalistScorecard scorecard={scorecard} />
        </View>
      ) : null}

      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <Text variant="kicker" color="inkTertiary">
          Claim history
        </Text>
        {claims.length === 0 ? (
          <EmptyState
            title="No claims logged"
            message="Log this journalist's next transfer claim to start scoring them."
            actionLabel="Add claim"
            onAction={() => router.push('/claim/new')}
          />
        ) : (
          <View style={{ marginHorizontal: -gutter }}>
            {claims.map((claim, index) => (
              <View key={claim.id}>
                {index > 0 ? <Divider /> : null}
                <ClaimRow claim={claim} onPress={() => router.push(`/claim/${claim.id}`)} />
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={{ gap: space.md, marginTop: space['2xl'] }}>
        <Button
          label={archived ? 'Unarchive' : 'Archive'}
          variant="secondary"
          onPress={() =>
            archiveMutation.mutate({ id: journalist.id, archived: !archived })
          }
        />
        <Button label="Delete journalist" variant="destructive" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

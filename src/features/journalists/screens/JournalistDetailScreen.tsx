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
import { Button, Card, EmptyState, Screen, Skeleton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text variant="caption" color="inkTertiary">
        {label}
      </Text>
    </View>
  );
}

/** Journalist detail: score hero, stat row, claim history, manage actions. */
export function JournalistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { space } = useTheme();
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
      <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
        <JournalistAvatar name={journalist.name} color={journalist.avatarColor} size={72} />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="title">{journalist.name}</Text>
          {journalist.outlet ? (
            <Text variant="secondary" color="inkSecondary">
              {journalist.outlet}
            </Text>
          ) : null}
          {journalist.handle ? (
            <Text variant="secondary" color="inkTertiary">
              @{journalist.handle}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Text variant="score">{formatScore(stats.score)}</Text>
          <TierBadge tier={stats.tier} size="lg" />
        </View>
        {stats.tier === null ? (
          <Text variant="secondary" color="inkTertiary">
            Resolve {3 - stats.resolvedCount} more claim{3 - stats.resolvedCount === 1 ? '' : 's'} to rank
          </Text>
        ) : null}
      </View>

      <Card>
        <View style={{ flexDirection: 'row' }}>
          <StatCell label="Claims" value={String(stats.resolvedCount)} />
          <StatCell label="Accuracy" value={formatAccuracy(stats.accuracy)} />
          <StatCell label="Streak" value={String(stats.streak)} />
        </View>
      </Card>

      {scorecard ? (
        <View style={{ marginTop: space.xl }}>
          <JournalistScorecard scorecard={scorecard} />
        </View>
      ) : null}

      <View style={{ gap: space.md, marginTop: space.xl }}>
        <Text variant="caption" color="inkTertiary">
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
          claims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} onPress={() => router.push(`/claim/${claim.id}`)} />
          ))
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

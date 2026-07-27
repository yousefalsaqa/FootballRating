import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, View } from 'react-native';

import type { ClaimOutcome } from '@/db/schema';
import { CONFIDENCE_LABELS, OutcomePill } from '@/features/claims/components';
import {
  useClaim,
  useClaimTags,
  useDeleteClaim,
  useReopenClaim,
  useResolveClaim,
  useScoringRows,
} from '@/features/claims/hooks';
import { useJournalist } from '@/features/journalists/hooks';
import { scoreImpact } from '@/features/scoring/engine';
import { windowLabel } from '@/lib/dates';
import { formatDate, formatDelta } from '@/lib/format';
import { Button, Card, EmptyState, KeyValueRow, Screen, Skeleton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** Claim detail: full record, resolve actions while pending, impact once resolved. */
export function ClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { space } = useTheme();
  const claimQuery = useClaim(id);
  const claim = claimQuery.data;
  const journalistQuery = useJournalist(claim?.journalistId ?? '');
  const tagsQuery = useClaimTags(id);
  const rowsQuery = useScoringRows();
  const resolveMutation = useResolveClaim();
  const reopenMutation = useReopenClaim();
  const deleteMutation = useDeleteClaim();

  const impact = useMemo(() => {
    if (!claim || claim.status !== 'resolved' || !claim.outcome || !rowsQuery.data) {
      return null;
    }
    const { rows, asOf } = rowsQuery.data;
    const journalistRows = rows.filter((r) => r.journalistId === claim.journalistId);
    const target = journalistRows.find(
      (r) => r.claimedAt === claim.claimedAt && r.resolvedAt === claim.resolvedAt,
    );
    return target ? scoreImpact(journalistRows, target, asOf) : null;
  }, [claim, rowsQuery.data]);

  if (claimQuery.isLoading) {
    return (
      <Screen>
        <View style={{ gap: space.md, paddingTop: space.xl }}>
          <Skeleton height={120} />
          <Skeleton height={200} />
        </View>
      </Screen>
    );
  }
  if (!claim) {
    return (
      <Screen>
        <EmptyState title="Not found" message="This claim no longer exists." />
      </Screen>
    );
  }

  const resolve = (outcome: ClaimOutcome) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resolveMutation.mutate({ id: claim.id, outcome });
  };

  const confirmDelete = () => {
    Alert.alert('Delete claim?', 'This removes the claim permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(claim.id, { onSuccess: () => router.back() }),
      },
    ]);
  };

  const tagList = (tagsQuery.data ?? []).map((t) => t.name).join(', ');

  return (
    <Screen>
      <View style={{ gap: space.lg, paddingTop: space.lg }}>
        <Text variant="title">{claim.headline}</Text>

        {claim.outcome ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <OutcomePill outcome={claim.outcome} />
            {impact !== null ? (
              <Text variant="secondary" color="inkSecondary">
                Score impact {formatDelta(impact)}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Card>
          <KeyValueRow label="Journalist" value={journalistQuery.data?.name ?? '—'} />
          <KeyValueRow label="Player" value={claim.playerName} />
          {claim.fromClubName ? <KeyValueRow label="From" value={claim.fromClubName} /> : null}
          <KeyValueRow label="To" value={claim.toClubName} />
          {claim.league ? <KeyValueRow label="League" value={claim.league} /> : null}
          <KeyValueRow label="Confidence" value={CONFIDENCE_LABELS[claim.confidence]} />
          {claim.transferWindow ? (
            <KeyValueRow label="Window" value={windowLabel(claim.transferWindow)} />
          ) : null}
          <KeyValueRow label="Claimed" value={formatDate(claim.claimedAt)} />
          {claim.resolvedAt ? (
            <KeyValueRow label="Resolved" value={formatDate(claim.resolvedAt)} />
          ) : null}
          {tagList ? <KeyValueRow label="Tags" value={tagList} /> : null}
          {claim.notes ? <KeyValueRow label="Notes" value={claim.notes} /> : null}
        </Card>

        {claim.status === 'pending' ? (
          <View style={{ gap: space.md }}>
            <Text variant="caption" color="inkTertiary">
              Resolve
            </Text>
            <Button label="Came true" onPress={() => resolve('true')} haptic />
            <Button label="Partially true" variant="secondary" onPress={() => resolve('partial')} />
            <Button label="False" variant="destructive" onPress={() => resolve('false')} />
          </View>
        ) : (
          <Button
            label="Reopen claim"
            variant="secondary"
            onPress={() => reopenMutation.mutate(claim.id)}
          />
        )}

        <Button label="Delete claim" variant="ghost" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

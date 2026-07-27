import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, View } from 'react-native';

import type { ClaimOutcome } from '@/db/schema';
import { CONFIDENCE_LABELS, VerdictStamp } from '@/features/claims/components';
import {
  useClaim,
  useClaimTags,
  useDeleteClaim,
  useReopenClaim,
  useResolveClaim,
  useScoringRows,
} from '@/features/claims/hooks';
import { useTransferCheck } from '@/features/football/hooks';
import { useJournalist } from '@/features/journalists/hooks';
import { scoreImpact } from '@/features/scoring/engine';
import { windowLabel } from '@/lib/dates';
import { formatDate, formatDelta } from '@/lib/format';
import { successTick } from '@/lib/haptics';
import { normalizeSourceUrl } from '@/lib/links';
import { Button, Card, Divider, EmptyState, KeyValueRow, Screen, Skeleton, Text } from '@/ui/components';
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
  const transferCheck = useTransferCheck();

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
    successTick();
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
        <View style={{ gap: space.xs }}>
          <Text variant="kicker" color="danger">
            Transfer desk · {formatDate(claim.claimedAt)}
          </Text>
          <Text variant="display" style={{ fontSize: 30, lineHeight: 31 }}>
            {claim.headline}
          </Text>
          {journalistQuery.data ? (
            <Text variant="secondary" color="inkSecondary">
              Filed by {journalistQuery.data.name}, confidence {claim.confidence}/3.
            </Text>
          ) : null}
        </View>

        {claim.outcome ? (
          <View style={{ gap: space.sm }}>
            <Text variant="kicker" color="inkTertiary">
              Final verdict
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <VerdictStamp verdict={claim.outcome} size="lg" />
              {impact !== null ? (
                <Text variant="secondary" color="inkSecondary">
                  Rating effect {formatDelta(impact)}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <VerdictStamp verdict="pending" size="lg" />
        )}

        <View>
          <Divider weight="medium" />
          <View style={{ paddingVertical: space.sm }}>
            <Text variant="kicker" color="inkTertiary">
              The claim
            </Text>
          </View>
          <KeyValueRow label="Reporter" value={journalistQuery.data?.name ?? '—'} />
          <KeyValueRow label="Player" value={claim.playerName} />
          {claim.fromClubName ? <KeyValueRow label="From" value={claim.fromClubName} /> : null}
          <KeyValueRow label="To" value={claim.toClubName} />
          {claim.league ? <KeyValueRow label="League" value={claim.league} /> : null}
          <KeyValueRow label="Confidence" value={CONFIDENCE_LABELS[claim.confidence]} />
          {claim.transferWindow ? (
            <KeyValueRow label="Window" value={windowLabel(claim.transferWindow)} />
          ) : null}
          <KeyValueRow label="Filed" value={formatDate(claim.claimedAt)} />
          {claim.resolvedAt ? (
            <KeyValueRow label="Resolved" value={formatDate(claim.resolvedAt)} />
          ) : null}
          {tagList ? <KeyValueRow label="Tags" value={tagList} /> : null}
          {claim.notes ? <KeyValueRow label="Notes" value={claim.notes} /> : null}
          <Divider weight="medium" />
        </View>

        {claim.sourceUrl ? (
          <Button
            label="View source"
            variant="secondary"
            onPress={() => void Linking.openURL(normalizeSourceUrl(claim.sourceUrl as string))}
          />
        ) : null}

        {claim.status === 'pending' ? (
          <View style={{ gap: space.md }}>
            <Text variant="kicker" color="inkTertiary">
              Record the outcome
            </Text>
            {claim.playerApiId !== null ? (
              <>
                <Button
                  label={transferCheck.isPending ? 'Checking…' : 'Check transfer records'}
                  variant="secondary"
                  disabled={transferCheck.isPending}
                  onPress={() => transferCheck.mutate(claim.playerApiId as number)}
                />
                {transferCheck.data?.ok ? (
                  <Card>
                    {transferCheck.data.data.length === 0 ||
                    (transferCheck.data.data[0]?.transfers.length ?? 0) === 0 ? (
                      <Text variant="secondary" color="inkSecondary">
                        No transfer records found for this player.
                      </Text>
                    ) : (
                      transferCheck.data.data[0]?.transfers.slice(0, 3).map((t, i) => (
                        <KeyValueRow
                          key={`${t.date}-${i}`}
                          label={t.date}
                          value={`${t.teams.out.name ?? '?'} → ${t.teams.in.name ?? '?'}`}
                        />
                      ))
                    )}
                  </Card>
                ) : transferCheck.data ? (
                  <Text variant="secondary" color="inkTertiary">
                    {transferCheck.data.reason === 'budget'
                      ? 'Daily lookup limit reached — resolve manually today.'
                      : 'Lookup unavailable — resolve manually.'}
                  </Text>
                ) : null}
              </>
            ) : null}
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

import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Claim } from '@/db/schema';
import { ClaimRow } from '@/features/claims/components';
import { useClaims, useResolveClaim } from '@/features/claims/hooks';
import { IncomingRow } from '@/features/inbox/components';
import {
  useAcceptIncoming,
  useInboxEnabled,
  useIncomingClaims,
  useResolveAllPending,
} from '@/features/inbox/hooks';
import { useEditorMode } from '@/features/settings/hooks';
import { useSettingsStore } from '@/features/settings/store';
import { useJournalists } from '@/features/journalists/hooks';
import { Chip, Divider, EmptyState, Screen, SegmentedControl, Skeleton, Text } from '@/ui/components';
import { useTheme } from '@/ui/theme';

/** Claims tab: pending/resolved lists across all journalists. */
export function ClaimsScreen() {
  const router = useRouter();
  const { colors, rules, space } = useTheme();
  const insets = useSafeAreaInsets();
  const inboxEnabled = useInboxEnabled();
  const editor = useEditorMode();
  const [section, setSection] = useState<'incoming' | 'pending' | 'resolved'>('pending');
  const status = section === 'resolved' ? 'resolved' : 'pending';
  const [journalistFilter, setJournalistFilter] = useState<string | null>(null);
  const claimsQuery = useClaims({ status, journalistId: journalistFilter ?? undefined });
  const journalistsQuery = useJournalists();
  const resolveMutation = useResolveClaim();
  const inbox = useIncomingClaims();
  const acceptIncoming = useAcceptIncoming();
  const autoFile = useSettingsStore((s) => s.autoFileIncoming);
  const resolveAll = useResolveAllPending();

  const journalistNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of journalistsQuery.data ?? []) {
      map.set(j.id, j.name);
    }
    return map;
  }, [journalistsQuery.data]);

  // Reader submissions may arrive naming a journalist without an id — map it back.
  const journalistIdsByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of journalistsQuery.data ?? []) {
      map.set(j.name.trim().toLowerCase(), j.id);
    }
    return map;
  }, [journalistsQuery.data]);

  const quickResolve = (claim: Claim) => {
    if (claim.status !== 'pending') {
      return;
    }
    // Alert menus are a no-op on web — the claim page has the full buttons.
    if (Platform.OS === 'web') {
      router.push(`/claim/${claim.id}`);
      return;
    }
    Alert.alert('Resolve claim', claim.headline, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'False', style: 'destructive', onPress: () => resolveMutation.mutate({ id: claim.id, outcome: 'false' }) },
      { text: 'Partially', onPress: () => resolveMutation.mutate({ id: claim.id, outcome: 'partial' }) },
      { text: 'Came true', onPress: () => resolveMutation.mutate({ id: claim.id, outcome: 'true' }) },
    ]);
  };

  return (
    <Screen scroll={false} edgeToEdge>
      <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg }}>
        <Text variant="kicker" color="danger">
          The Transfer Desk
        </Text>
        <Text variant="display" style={{ fontSize: 30, lineHeight: 31, marginTop: 2 }}>
          Latest reports
        </Text>
        <Text variant="secondary" color="inkSecondary" style={{ marginTop: 2, marginBottom: space.md }}>
          Reports filed into the public record.
        </Text>
      </View>
      <Divider weight="strong" />
      <View style={{ paddingVertical: space.md, paddingHorizontal: space.lg, gap: space.md }}>
        <SegmentedControl
          options={
            inboxEnabled && editor
              ? ([
                  { value: 'incoming', label: `Incoming${inbox.drafts.length ? ` (${inbox.drafts.length})` : ''}` },
                  { value: 'pending', label: 'Pending' },
                  { value: 'resolved', label: 'Resolved' },
                ] as const)
              : ([
                  { value: 'pending', label: 'Pending' },
                  { value: 'resolved', label: 'Resolved' },
                ] as const)
          }
          value={section}
          onChange={setSection}
        />
        {editor && section === 'pending' && resolveAll.enabled && resolveAll.pendingCount > 0 ? (
          <View style={{ gap: 4 }}>
            <Text
              variant="stamp"
              color="ink"
              accessibilityRole="button"
              onPress={() => void resolveAll.run()}
              disabled={resolveAll.running}
              style={{
                alignSelf: 'flex-start',
                borderWidth: rules.medium,
                borderColor: colors.ink,
                paddingHorizontal: space.sm,
                paddingVertical: 4,
                opacity: resolveAll.running ? 0.5 : 1,
              }}
            >
              {resolveAll.running
                ? 'Checking press coverage…'
                : `Check outcomes now (${resolveAll.pendingCount})`}
            </Text>
            {resolveAll.summary ? (
              <Text variant="caption" color="inkSecondary">
                {resolveAll.summary}
              </Text>
            ) : null}
          </View>
        ) : null}
        {section !== 'incoming' && (journalistsQuery.data?.length ?? 0) > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm }}
          >
            <Chip
              label="All"
              selected={journalistFilter === null}
              onPress={() => setJournalistFilter(null)}
            />
            {(journalistsQuery.data ?? []).map((j) => (
              <Chip
                key={j.id}
                label={j.name}
                selected={journalistFilter === j.id}
                onPress={() => setJournalistFilter(journalistFilter === j.id ? null : j.id)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
      {section === 'incoming' ? (
        inbox.drafts.length === 0 ? (
          <EmptyState
            title={inbox.isError ? 'Wire unavailable' : 'Nothing on the wire'}
            message={
              inbox.isError
                ? 'Could not reach the ingest service — check your connection.'
                : autoFile
                  ? 'Fresh reports are filed into the record automatically. Turn auto-file off in the Desk tab to review them here first.'
                  : 'New reports appear here as journalists publish. Unreviewed reports expire after 72 hours and never affect ratings.'
            }
          />
        ) : (
          <FlashList
            data={inbox.drafts}
            keyExtractor={(draft) => draft.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
            ItemSeparatorComponent={() => <Divider />}
            renderItem={({ item }) => (
              <IncomingRow
                draft={item}
                journalistName={journalistNames.get(item.journalistId) ?? item.journalistName ?? undefined}
                onAccept={() => {
                  const journalistId =
                    item.journalistId ||
                    journalistIdsByName.get((item.journalistName ?? '').trim().toLowerCase());
                  if (journalistId) {
                    acceptIncoming({ ...item, journalistId });
                  }
                }}
                onDismiss={() => inbox.dismiss(item.id)}
              />
            )}
          />
        )
      ) : claimsQuery.isLoading ? (
        <View style={{ gap: space.md, paddingHorizontal: space.lg }}>
          <Skeleton height={96} />
          <Skeleton height={96} />
        </View>
      ) : (claimsQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="No reports filed"
          message={
            status === 'pending'
              ? 'The archive contains no developing stories matching these filters.'
              : 'The archive contains no resolved reports matching these filters.'
          }
          actionLabel={status === 'pending' ? 'File a claim' : undefined}
          onAction={status === 'pending' ? () => router.push('/claim/new') : undefined}
        />
      ) : (
        <FlashList
          data={claimsQuery.data}
          keyExtractor={(claim) => claim.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
          ItemSeparatorComponent={() => <Divider />}
          renderItem={({ item }) => (
            <ClaimRow
              claim={item}
              journalistName={journalistNames.get(item.journalistId)}
              onPress={() => router.push(`/claim/${item.id}`)}
              onLongPress={editor ? () => quickResolve(item) : undefined}
            />
          )}
        />
      )}
    </Screen>
  );
}

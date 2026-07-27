import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useClaims, useCreateClaim, useResolveClaim } from '@/features/claims/hooks';
import {
  fetchIncomingClaims,
  ingestUrl,
  requestResolutions,
  type IncomingClaim,
} from '@/features/inbox/api';
import { useInboxStore } from '@/features/inbox/store';
import { useSettingsStore } from '@/features/settings/store';
import { currentTransferWindow } from '@/lib/dates';
import { kv } from '@/lib/kv';
import { queryKeys } from '@/lib/query-client';

/** Whether the ingest worker is configured — gates all inbox UI. */
export function useInboxEnabled(): boolean {
  return ingestUrl() !== undefined;
}

/** Incoming claim drafts minus everything already handled locally. */
export function useIncomingClaims() {
  const enabled = useInboxEnabled();
  const dismissedIds = useInboxStore((s) => s.dismissedIds);
  const dismiss = useInboxStore((s) => s.dismiss);

  const query = useQuery({
    queryKey: queryKeys.inbox.all,
    queryFn: fetchIncomingClaims,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  const visible = useMemo(
    () => (query.data ?? []).filter((draft) => !dismissedIds.includes(draft.id)),
    [query.data, dismissedIds],
  );

  return { drafts: visible, isLoading: query.isLoading, isError: query.isError, dismiss };
}

/** Accepts a draft into the real claims table (and clears it from the wire). */
export function useAcceptIncoming() {
  const createMutation = useCreateClaim();
  const dismiss = useInboxStore((s) => s.dismiss);
  return useCallback(
    (draft: IncomingClaim) => {
      createMutation.mutate(
        {
          input: {
            journalistId: draft.journalistId,
            headline: draft.headline,
            playerName: draft.playerName,
            playerApiId: null,
            fromClubName: draft.fromClubName,
            fromClubApiId: null,
            toClubName: draft.toClubName,
            toClubApiId: null,
            league: draft.league,
            confidence: draft.confidence,
            transferWindow: currentTransferWindow(draft.reportedAt),
            sourceUrl: draft.sourceUrl,
            notes: null,
            claimedAt: draft.reportedAt,
          },
        },
        { onSuccess: () => dismiss(draft.id) },
      );
    },
    [createMutation, dismiss],
  );
}

/**
 * Auto-file: when enabled (default), every fresh wire report is filed into the
 * record automatically — counts and ratings grow without manual review.
 * Mounted once in the tab layout.
 */
export function useAutoFileIncoming(): void {
  const enabled = useSettingsStore((s) => s.autoFileIncoming);
  const { drafts } = useIncomingClaims();
  const accept = useAcceptIncoming();
  const processing = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) {
      return;
    }
    for (const draft of drafts) {
      if (!processing.current.has(draft.id)) {
        processing.current.add(draft.id);
        accept(draft);
      }
    }
  }, [enabled, drafts, accept]);
}

const CHECKED_KEY = 'resolve.checkedAt';
const RECHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const MIN_CLAIM_AGE_MS = 24 * 60 * 60 * 1000;

function loadCheckedMap(): Record<string, number> {
  try {
    return JSON.parse(kv.getItemSync(CHECKED_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/**
 * Auto-resolve: periodically asks the worker to judge pending claims from
 * recent press coverage and records conclusive verdicts. 'unknown' verdicts
 * leave the claim open — a wrong ruling is worse than a late one.
 */
export function useAutoResolve(): void {
  const autoResolve = useSettingsStore((s) => s.autoResolve);
  const inboxEnabled = useInboxEnabled();
  const enabled = autoResolve && inboxEnabled;
  const pendingQuery = useClaims({ status: 'pending' });
  const resolveMutation = useResolveClaim();
  const running = useRef(false);

  const pending = pendingQuery.data;
  useEffect(() => {
    if (!enabled || !pending?.length || running.current) {
      return;
    }
    const now = Date.now();
    const checked = loadCheckedMap();
    const due = pending
      .filter((c) => now - c.claimedAt > MIN_CLAIM_AGE_MS)
      .filter((c) => now - (checked[c.id] ?? 0) > RECHECK_INTERVAL_MS)
      .slice(0, 5);
    if (!due.length) {
      return;
    }
    running.current = true;
    requestResolutions(
      due.map((c) => ({
        id: c.id,
        headline: c.headline,
        playerName: c.playerName,
        toClubName: c.toClubName,
        fromClubName: c.fromClubName,
      })),
    )
      .then((verdicts) => {
        const nextChecked = loadCheckedMap();
        for (const claim of due) {
          nextChecked[claim.id] = now;
        }
        kv.setItemSync(CHECKED_KEY, JSON.stringify(nextChecked));
        for (const verdict of verdicts) {
          if (verdict.outcome !== 'unknown') {
            resolveMutation.mutate({ id: verdict.id, outcome: verdict.outcome });
          }
        }
      })
      .catch((e: unknown) => console.error('Auto-resolve failed', e))
      .finally(() => {
        running.current = false;
      });
  }, [enabled, pending, resolveMutation]);
}

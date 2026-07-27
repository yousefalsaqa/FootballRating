import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Claim } from '@/db/schema';
import { claimStoryKey, useClaims, useCreateClaim, useResolveClaim } from '@/features/claims/hooks';
import {
  fetchIncomingClaims,
  fetchPostAuthor,
  ingestUrl,
  requestResolutions,
  type IncomingClaim,
} from '@/features/inbox/api';
import { useInboxStore } from '@/features/inbox/store';
import { useSettingsStore } from '@/features/settings/store';
import { currentTransferWindow } from '@/lib/dates';
import { kv } from '@/lib/kv';
import { queryKeys } from '@/lib/query-client';

export { ingestUrl, submitReport, type ReportSubmission } from '@/features/inbox/api';

/** Whether the ingest worker is configured — gates all inbox UI. */
export function useInboxEnabled(): boolean {
  return ingestUrl() !== undefined;
}

/** The story key a wire draft would get once filed as a claim. */
function draftStoryKey(draft: IncomingClaim): string {
  return claimStoryKey({
    journalistId: draft.journalistId,
    playerName: draft.playerName,
    toClubName: draft.toClubName,
    transferWindow: currentTransferWindow(draft.reportedAt),
  });
}

/**
 * Incoming claim drafts minus everything already handled locally. The claims
 * table is the dedupe authority: a story already filed (this session or any
 * earlier one) never reappears on the wire, so auto-file can't duplicate it.
 */
export function useIncomingClaims() {
  // The wire is editor territory — readers never poll it.
  const editor = useSettingsStore((s) => s.syncKey !== null);
  const enabled = useInboxEnabled() && editor;
  const dismissedIds = useInboxStore((s) => s.dismissedIds);
  const dismiss = useInboxStore((s) => s.dismiss);
  const existingQuery = useClaims();

  const query = useQuery({
    queryKey: queryKeys.inbox.all,
    queryFn: fetchIncomingClaims,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  const existing = existingQuery.data;
  const visible = useMemo(() => {
    const filedKeys = new Set((existing ?? []).map(claimStoryKey));
    return (query.data ?? []).filter(
      (draft) => !dismissedIds.includes(draft.id) && !filedKeys.has(draftStoryKey(draft)),
    );
  }, [query.data, dismissedIds, existing]);

  return {
    drafts: visible,
    // Until the filed-story filter has data, auto-file must not act.
    isLoading: query.isLoading || existingQuery.isLoading,
    isError: query.isError,
    dismiss,
  };
}

/** Accepts a draft into the real claims table (and clears it from the wire). */
export function useAcceptIncoming() {
  const createMutation = useCreateClaim();
  const dismiss = useInboxStore((s) => s.dismiss);
  return useCallback(
    (draft: IncomingClaim, onFiled?: (claim: Claim) => void) => {
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
        {
          onSuccess: (claim) => {
            dismiss(draft.id);
            onFiled?.(claim);
          },
        },
      );
    },
    [createMutation, dismiss],
  );
}

/**
 * Reads a pasted Instagram post link via the worker: who wrote it, and — when
 * the caption itself reports a transfer — the extracted claim, ready to file.
 */
export function usePostLookup(postUrl: string | null) {
  const enabled = useInboxEnabled() && postUrl !== null;
  return useQuery({
    queryKey: [...queryKeys.inbox.all, 'post', postUrl ?? ''],
    queryFn: () => fetchPostAuthor(postUrl as string),
    enabled,
    staleTime: Infinity,
    retry: 1,
  });
}

/**
 * Auto-file: when enabled (default), every fresh wire report is filed into the
 * record automatically — counts and ratings grow without manual review.
 * Mounted once in the tab layout.
 */
export function useAutoFileIncoming(): void {
  const enabled = useSettingsStore((s) => s.autoFileIncoming);
  const { drafts, isLoading } = useIncomingClaims();
  const accept = useAcceptIncoming();
  const processing = useRef(new Set<string>());

  useEffect(() => {
    // Never file while the already-filed filter is still loading — acting on
    // an unfiltered wire is exactly how duplicate claims got created.
    if (!enabled || isLoading) {
      return;
    }
    for (const draft of drafts) {
      // Flagged reader submissions wait for the editor; unmatched reporters
      // can't be filed automatically either.
      if (draft.needsReview || !draft.journalistId) {
        continue;
      }
      if (!processing.current.has(draft.id)) {
        processing.current.add(draft.id);
        accept(draft);
      }
    }
  }, [enabled, isLoading, drafts, accept]);
}

const CHECKED_KEY = 'resolve.checkedAt';
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MIN_CLAIM_AGE_MS = 3 * 60 * 60 * 1000;
const RESOLVE_BATCH_SIZE = 5;

/** Payload the worker's /resolve endpoint needs for one claim. */
function toResolutionRequest(claim: Claim) {
  return {
    id: claim.id,
    headline: claim.headline,
    playerName: claim.playerName,
    toClubName: claim.toClubName,
    fromClubName: claim.fromClubName,
    claimedAt: claim.claimedAt,
  };
}

function markChecked(ids: string[], at: number): void {
  const checked = loadCheckedMap();
  for (const id of ids) {
    checked[id] = at;
  }
  kv.setItemSync(CHECKED_KEY, JSON.stringify(checked));
}

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
  const editor = useSettingsStore((s) => s.syncKey !== null);
  const inboxEnabled = useInboxEnabled();
  const enabled = autoResolve && inboxEnabled && editor;
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
      // Reopened claims are the editor's overrule — never re-judge them.
      .filter((c) => !c.reopenedAt)
      .filter((c) => now - c.claimedAt > MIN_CLAIM_AGE_MS)
      .filter((c) => now - (checked[c.id] ?? 0) > RECHECK_INTERVAL_MS)
      .slice(0, RESOLVE_BATCH_SIZE);
    if (!due.length) {
      return;
    }
    running.current = true;
    requestResolutions(due.map(toResolutionRequest))
      .then((verdicts) => {
        markChecked(
          due.map((c) => c.id),
          now,
        );
        for (const verdict of verdicts) {
          if (verdict.outcome !== 'unknown') {
            resolveMutation.mutate({
              id: verdict.id,
              outcome: verdict.outcome,
              evidence: { note: verdict.reason, sourceUrl: verdict.evidenceUrl },
            });
          }
        }
      })
      .catch((e: unknown) => console.error('Auto-resolve failed', e))
      .finally(() => {
        running.current = false;
      });
  }, [enabled, pending, resolveMutation]);
}

/**
 * Manual "check outcomes now": sweeps EVERY pending claim through the
 * resolution service in batches, ignoring the age/recheck gates the
 * background pass respects. Bound to a button on the Desk.
 */
export function useResolveAllPending() {
  const inboxEnabled = useInboxEnabled();
  const pendingQuery = useClaims({ status: 'pending' });
  const resolveMutation = useResolveClaim();
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const pending = useMemo(
    // Reopened claims are the editor's overrule — the sweep never re-judges them.
    () => (pendingQuery.data ?? []).filter((c) => !c.reopenedAt),
    [pendingQuery.data],
  );
  const run = useCallback(async () => {
    if (!inboxEnabled || running || !pending.length) {
      return;
    }
    setRunning(true);
    setSummary(null);
    let ruled = 0;
    try {
      for (let start = 0; start < pending.length; start += RESOLVE_BATCH_SIZE) {
        const batch = pending.slice(start, start + RESOLVE_BATCH_SIZE);
        const verdicts = await requestResolutions(batch.map(toResolutionRequest));
        markChecked(
          batch.map((c) => c.id),
          Date.now(),
        );
        for (const verdict of verdicts) {
          if (verdict.outcome !== 'unknown') {
            resolveMutation.mutate({
              id: verdict.id,
              outcome: verdict.outcome,
              evidence: { note: verdict.reason, sourceUrl: verdict.evidenceUrl },
            });
            ruled += 1;
          }
        }
      }
      setSummary(
        ruled > 0
          ? `Verdicts reached on ${ruled} of ${pending.length} pending claims. The rest are still developing stories.`
          : `No verdicts yet — the press coverage on all ${pending.length} pending claims is still inconclusive.`,
      );
    } catch (error) {
      console.error('Manual resolve sweep failed', error);
      setSummary('Could not reach the resolution service — try again in a minute.');
    } finally {
      setRunning(false);
    }
  }, [inboxEnabled, running, pending, resolveMutation]);

  return { run, running, summary, pendingCount: pending.length, enabled: inboxEnabled };
}

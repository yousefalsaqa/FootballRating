import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useCreateClaim } from '@/features/claims/hooks';
import { fetchIncomingClaims, ingestUrl, type IncomingClaim } from '@/features/inbox/api';
import { currentTransferWindow } from '@/lib/dates';
import { kv } from '@/lib/kv';
import { queryKeys } from '@/lib/query-client';

const DISMISSED_KEY = 'inbox.dismissed';
const DISMISSED_CAP = 300;

function loadDismissed(): string[] {
  try {
    const raw = kv.getItemSync(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Whether the ingest worker is configured — gates all inbox UI. */
export function useInboxEnabled(): boolean {
  return ingestUrl() !== undefined;
}

/** Incoming claim drafts minus everything already handled locally. */
export function useIncomingClaims() {
  const enabled = useInboxEnabled();
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);

  const query = useQuery({
    queryKey: queryKeys.inbox.all,
    queryFn: fetchIncomingClaims,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  const dismiss = useCallback((draftId: string) => {
    setDismissed((current) => {
      const next = [...current.filter((id) => id !== draftId), draftId].slice(-DISMISSED_CAP);
      kv.setItemSync(DISMISSED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const visible = useMemo(
    () => (query.data ?? []).filter((draft) => !dismissed.includes(draft.id)),
    [query.data, dismissed],
  );

  return { drafts: visible, isLoading: query.isLoading, isError: query.isError, dismiss };
}

/** Accepts a draft into the real claims table (and hides it from the inbox). */
export function useAcceptIncoming(dismiss: (draftId: string) => void) {
  const createMutation = useCreateClaim();
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

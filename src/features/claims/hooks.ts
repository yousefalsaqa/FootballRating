import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { ClaimOutcome } from '@/db/schema';
import {
  createClaim,
  deleteClaim,
  deleteDuplicateClaims,
  getClaim,
  getClaimTags,
  listClaimCountsByJournalist,
  listClaims,
  listScoringRows,
  listTags,
  reopenClaim,
  resolveClaim,
  type ClaimFilter,
  type CreateClaimInput,
  type ScoringRow,
} from '@/features/claims/repository';
import { queryKeys } from '@/lib/query-client';

export { claimStoryKey, deleteDuplicateClaims } from '@/features/claims/repository';

export function useClaims(filter?: ClaimFilter) {
  return useQuery({
    queryKey: [...queryKeys.claims.all, filter?.status ?? 'any', filter?.journalistId ?? 'any'],
    queryFn: () => listClaims(filter),
  });
}

export function useClaim(id: string) {
  return useQuery({ queryKey: queryKeys.claims.detail(id), queryFn: () => getClaim(id) });
}

export function useClaimTags(claimId: string) {
  return useQuery({
    queryKey: [...queryKeys.claims.detail(claimId), 'tags'],
    queryFn: () => getClaimTags(claimId),
  });
}

export function useTags() {
  return useQuery({ queryKey: queryKeys.tags.all, queryFn: () => listTags() });
}

/** Filed-claim totals per journalist (any status). */
export function useClaimCounts() {
  return useQuery({
    queryKey: [...queryKeys.claims.all, 'counts'],
    queryFn: () => listClaimCountsByJournalist(),
  });
}

/** Scoring input plus the moment it was captured — recency decay is computed against `asOf`. */
export interface ScoringSnapshot {
  rows: ScoringRow[];
  asOf: number;
}

/**
 * All resolved-claim rows — the single input every score computation shares.
 * Exposed here (claims own the data); journalists' hooks build on it.
 * `asOf` is stamped in the queryFn so render stays pure for the React Compiler.
 */
export function useScoringRows() {
  return useQuery({
    queryKey: queryKeys.scores.all,
    queryFn: async (): Promise<ScoringSnapshot> => ({
      rows: await listScoringRows(),
      asOf: Date.now(),
    }),
  });
}

/** Every claim mutation invalidates claims + derived scores in one place. */
function useInvalidateClaims() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.claims.all });
    void client.invalidateQueries({ queryKey: queryKeys.scores.all });
    void client.invalidateQueries({ queryKey: queryKeys.tags.all });
  };
}

/**
 * One-shot startup sweep that collapses duplicate filings of the same story
 * (auto-file could re-file drafts when its seen-list reset between sessions).
 */
export function useDedupeClaims(): void {
  const invalidate = useInvalidateClaims();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) {
      return;
    }
    ran.current = true;
    deleteDuplicateClaims()
      .then((removed) => {
        if (removed > 0) {
          invalidate();
        }
      })
      .catch((e: unknown) => console.error('Claim dedupe failed', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);
}

export function useCreateClaim() {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: ({ input, tagNames }: { input: CreateClaimInput; tagNames?: string[] }) =>
      createClaim(input, tagNames),
    onSuccess: invalidate,
  });
}

export function useResolveClaim() {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: ClaimOutcome }) =>
      resolveClaim(id, outcome),
    onSuccess: invalidate,
  });
}

export function useReopenClaim() {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (id: string) => reopenClaim(id),
    onSuccess: invalidate,
  });
}

export function useDeleteClaim() {
  const invalidate = useInvalidateClaims();
  return useMutation({
    mutationFn: (id: string) => deleteClaim(id),
    onSuccess: invalidate,
  });
}

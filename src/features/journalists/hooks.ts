import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Journalist } from '@/db/schema';
import { useClaimCounts, useScoringRows } from '@/features/claims/hooks';
import {
  computeScorecard,
  computeStats,
  computeStatsByJournalist,
  type Scorecard,
} from '@/features/scoring/engine';
import type { JournalistStats } from '@/features/scoring/types';
import {
  createJournalist,
  deleteJournalist,
  getJournalist,
  listJournalists,
  setJournalistArchived,
  updateJournalist,
} from '@/features/journalists/repository';
import { queryKeys } from '@/lib/query-client';

export interface RankedJournalist extends Journalist {
  stats: JournalistStats;
  /** Total filed claims, any status. */
  filedCount: number;
}

export function useJournalists() {
  return useQuery({ queryKey: queryKeys.journalists.all, queryFn: () => listJournalists() });
}

export function useJournalist(id: string) {
  return useQuery({
    queryKey: queryKeys.journalists.detail(id),
    queryFn: () => getJournalist(id),
  });
}

/** Journalists joined with their computed stats — the leaderboard's data. */
export function useRankedJournalists() {
  const journalistsQuery = useJournalists();
  const rowsQuery = useScoringRows();
  const countsQuery = useClaimCounts();

  const ranked = useMemo<RankedJournalist[] | undefined>(() => {
    if (!journalistsQuery.data || !rowsQuery.data) {
      return undefined;
    }
    const { rows, asOf } = rowsQuery.data;
    const statsById = computeStatsByJournalist(rows, asOf);
    const empty = computeStats([], asOf);
    const counts = countsQuery.data;
    // Pure score order — one continuous league table (tiers are labels, not
    // sections, so unranked entries interleaving is intended here).
    return journalistsQuery.data
      .map((j) => ({
        ...j,
        stats: statsById.get(j.id) ?? empty,
        filedCount: counts?.get(j.id) ?? 0,
      }))
      .sort((a, b) => b.stats.score - a.stats.score);
  }, [journalistsQuery.data, rowsQuery.data, countsQuery.data]);

  return {
    data: ranked,
    isLoading: journalistsQuery.isLoading || rowsQuery.isLoading,
  };
}

/** Stats for a single journalist, from the shared scoring rows. */
export function useJournalistStats(journalistId: string) {
  const rowsQuery = useScoringRows();
  return useMemo(() => {
    if (!rowsQuery.data) {
      return undefined;
    }
    const { rows, asOf } = rowsQuery.data;
    return computeStats(
      rows.filter((r) => r.journalistId === journalistId),
      asOf,
    );
  }, [rowsQuery.data, journalistId]);
}

/** The explainable "why" behind one journalist's score. */
export function useJournalistScorecard(journalistId: string): Scorecard | undefined {
  const rowsQuery = useScoringRows();
  return useMemo(() => {
    if (!rowsQuery.data) {
      return undefined;
    }
    const { rows, asOf } = rowsQuery.data;
    return computeScorecard(
      rows.filter((r) => r.journalistId === journalistId),
      asOf,
    );
  }, [rowsQuery.data, journalistId]);
}

function useInvalidateJournalists() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.journalists.all });
    void client.invalidateQueries({ queryKey: queryKeys.scores.all });
  };
}

export function useCreateJournalist() {
  const invalidate = useInvalidateJournalists();
  return useMutation({
    mutationFn: (input: { name: string; outlet?: string; handle?: string }) =>
      createJournalist(input),
    onSuccess: invalidate,
  });
}

export function useUpdateJournalist(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<Journalist, 'name' | 'outlet'>>) =>
      updateJournalist(id, patch),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.journalists.all });
      void client.invalidateQueries({ queryKey: queryKeys.journalists.detail(id) });
    },
  });
}

export function useSetJournalistArchived() {
  const invalidate = useInvalidateJournalists();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      setJournalistArchived(id, archived),
    onSuccess: invalidate,
  });
}

export function useDeleteJournalist() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJournalist(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.journalists.all });
      void client.invalidateQueries({ queryKey: queryKeys.claims.all });
      void client.invalidateQueries({ queryKey: queryKeys.scores.all });
    },
  });
}

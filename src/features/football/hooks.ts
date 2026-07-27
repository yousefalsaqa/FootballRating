import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getTodayUsage } from '@/features/football/cache';
import { getPlayerTransfers, searchPlayers, searchTeams } from '@/features/football/endpoints';
import { ApiFailureError, type ApiResult } from '@/features/football/types';
import { queryKeys } from '@/lib/query-client';
import { useDebouncedValue } from '@/lib/use-debounced-value';

/** Failures must THROW so TanStack Query never caches them as fresh data. */
function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new ApiFailureError(result.reason);
  }
  return result.data;
}

/** Search fires at ≥3 chars after 450 ms idle — one request per typed query. */
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 450;

const API_QUERY_OPTIONS = {
  staleTime: 24 * 60 * 60 * 1000,
  gcTime: 48 * 60 * 60 * 1000,
  retry: 1,
  refetchOnWindowFocus: false,
} as const;

function useInvalidateUsage() {
  const client = useQueryClient();
  return () => void client.invalidateQueries({ queryKey: queryKeys.football.usage });
}

export function usePlayerSearch(rawQuery: string) {
  const query = useDebouncedValue(rawQuery.trim(), DEBOUNCE_MS);
  const invalidateUsage = useInvalidateUsage();
  return useQuery({
    ...API_QUERY_OPTIONS,
    queryKey: queryKeys.football.playerSearch(query),
    enabled: query.length >= MIN_QUERY_LENGTH,
    queryFn: async () => {
      const result = await searchPlayers(query);
      invalidateUsage();
      return unwrap(result);
    },
  });
}

export function useTeamSearch(rawQuery: string) {
  const query = useDebouncedValue(rawQuery.trim(), DEBOUNCE_MS);
  const invalidateUsage = useInvalidateUsage();
  return useQuery({
    ...API_QUERY_OPTIONS,
    queryKey: queryKeys.football.teamSearch(query),
    enabled: query.length >= MIN_QUERY_LENGTH,
    queryFn: async () => {
      const result = await searchTeams(query);
      invalidateUsage();
      return unwrap(result);
    },
  });
}

/** Explicit-tap transfer lookup on the resolve screen — never automatic. */
export function useTransferCheck() {
  const invalidateUsage = useInvalidateUsage();
  return useMutation({
    mutationFn: (playerApiId: number) => getPlayerTransfers(playerApiId),
    onSettled: invalidateUsage,
  });
}

/** Today's request count for the Settings usage meter. */
export function useApiUsage() {
  return useQuery({
    queryKey: queryKeys.football.usage,
    queryFn: () => getTodayUsage(Date.now()),
    staleTime: 60 * 1000,
  });
}

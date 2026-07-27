import { QueryClient } from '@tanstack/react-query';

/**
 * One QueryClient for the whole app.
 * - DB-backed queries: staleTime Infinity, invalidated explicitly on writes.
 * - Football API queries override with their own staleTime (see features/football).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * The single query-key factory — no ad-hoc key strings anywhere else.
 * Scores derive from claims, so claim mutations invalidate `scores` too.
 */
export const queryKeys = {
  journalists: {
    all: ['journalists'] as const,
    detail: (id: string) => ['journalists', id] as const,
  },
  claims: {
    all: ['claims'] as const,
    detail: (id: string) => ['claims', id] as const,
    byJournalist: (journalistId: string) => ['claims', 'journalist', journalistId] as const,
  },
  scores: {
    all: ['scores'] as const,
  },
  tags: {
    all: ['tags'] as const,
  },
  inbox: {
    all: ['inbox'] as const,
  },
  football: {
    playerSearch: (query: string) => ['football', 'players', query.toLowerCase()] as const,
    teamSearch: (query: string) => ['football', 'teams', query.toLowerCase()] as const,
    transfers: (playerApiId: number) => ['football', 'transfers', playerApiId] as const,
    usage: ['football', 'usage'] as const,
  },
} as const;

import { z } from 'zod';

import { normalizeSourceUrl } from '@/lib/links';

/**
 * Client for the ingest worker (see worker/). Separate service from the
 * football API — this is our own endpoint, no budget/caching layer needed.
 */

const incomingClaimSchema = z.object({
  id: z.string(),
  journalistId: z.string(),
  headline: z.string(),
  playerName: z.string(),
  fromClubName: z.string().nullable(),
  toClubName: z.string(),
  league: z.string().nullable(),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  sourceUrl: z.string(),
  reportedAt: z.number(),
});

export type IncomingClaim = z.infer<typeof incomingClaimSchema>;

const responseSchema = z.object({ claims: z.array(incomingClaimSchema) });

/** Worker base URL; inbox UI is hidden entirely when unset. */
export function ingestUrl(): string | undefined {
  return process.env.EXPO_PUBLIC_INGEST_URL || undefined;
}

const verdictSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.string(),
      outcome: z.enum(['true', 'partial', 'false', 'unknown']),
    }),
  ),
});

export interface ResolutionRequest {
  id: string;
  headline: string;
  playerName: string;
  toClubName: string;
  fromClubName?: string | null;
}

/** Asks the worker to judge pending claims from recent coverage (max 5). */
export async function requestResolutions(
  claims: ResolutionRequest[],
): Promise<{ id: string; outcome: 'true' | 'partial' | 'false' | 'unknown' }[]> {
  const base = ingestUrl();
  if (!base || claims.length === 0) {
    return [];
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/resolve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ claims }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Resolve request failed: ${response.status}`);
  }
  return verdictSchema.parse(await response.json()).verdicts;
}

export async function fetchIncomingClaims(): Promise<IncomingClaim[]> {
  const base = ingestUrl();
  if (!base) {
    return [];
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/claims`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Ingest fetch failed: ${response.status}`);
  }
  return responseSchema
    .parse(await response.json())
    .claims.map((c) => ({ ...c, sourceUrl: normalizeSourceUrl(c.sourceUrl) }));
}

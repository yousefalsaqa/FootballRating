import { z } from 'zod';

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
  return responseSchema.parse(await response.json()).claims;
}

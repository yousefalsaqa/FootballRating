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
  /** Reader submission the bot couldn't vouch for — editor must approve. */
  needsReview: z.boolean().optional().default(false),
  submitted: z.boolean().optional().default(false),
  journalistName: z.string().nullable().optional().default(null),
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
      reason: z.string().nullable().optional().default(null),
      evidenceTitle: z.string().nullable().optional().default(null),
      evidenceUrl: z.string().nullable().optional().default(null),
    }),
  ),
});

export type ResolutionVerdict = z.infer<typeof verdictSchema>['verdicts'][number];

export interface ResolutionRequest {
  id: string;
  headline: string;
  playerName: string;
  toClubName: string;
  fromClubName?: string | null;
  claimedAt?: number;
}

/** Asks the worker to judge pending claims from recent coverage (max 5). */
export async function requestResolutions(claims: ResolutionRequest[]): Promise<ResolutionVerdict[]> {
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

const authorSchema = z.object({
  username: z.string().nullable(),
  name: z.string().nullable(),
  postedAt: z.number().nullable(),
  /** Filled when the post's caption itself reports a transfer claim. */
  claim: incomingClaimSchema.omit({ id: true, journalistId: true }).nullable(),
});

export type PostAuthor = z.infer<typeof authorSchema>;

/** Asks the worker who authored a pasted Instagram post/reel link. */
export async function fetchPostAuthor(postUrl: string): Promise<PostAuthor> {
  const base = ingestUrl();
  if (!base) {
    return { username: null, name: null, postedAt: null, claim: null };
  }
  const response = await fetch(
    `${base.replace(/\/$/, '')}/author?url=${encodeURIComponent(postUrl)}`,
    { signal: AbortSignal.timeout(20_000) },
  );
  if (!response.ok) {
    throw new Error(`Author lookup failed: ${response.status}`);
  }
  return authorSchema.parse(await response.json());
}

export interface ReportSubmission {
  journalistName: string;
  playerName: string;
  toClubName: string;
  fromClubName?: string | null;
  league?: string | null;
  headline?: string | null;
  sourceUrl?: string | null;
}

/**
 * Sends a reader-submitted report to the worker, where the bot vets it.
 * Returns whether it will need the editor's approval before appearing.
 */
export async function submitReport(input: ReportSubmission): Promise<{ needsReview: boolean }> {
  const base = ingestUrl();
  if (!base) {
    throw new Error('Submissions unavailable');
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Submission failed: ${response.status}`);
  }
  const body = (await response.json()) as { needsReview?: boolean };
  return { needsReview: body.needsReview ?? true };
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

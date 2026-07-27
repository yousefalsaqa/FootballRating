import { tierForScore } from '@/features/scoring/tiers';
import type { JournalistStats, ScorableClaim } from '@/features/scoring/types';

/**
 * The reliability algorithm — the only place scores are computed.
 *
 * Per resolved claim:
 *   outcome value  v = true 1.0 | partial 0.5 | false 0.0
 *   confidence     c = 3 (confirmed) | 2 (advanced) | 1 (speculative)
 *   recency decay  r = 0.5 ^ (ageDays / 540)   — 18-month half-life
 *   weight         w = c × r
 *
 * score = 100 × (Σ wv + PRIOR_MEAN × PRIOR_STRENGTH) / (Σ w + PRIOR_STRENGTH)
 *
 * The Bayesian prior pulls small samples toward 50 so a lucky 2-for-2 record
 * can't outrank a proven 45-for-50 one.
 */

const OUTCOME_VALUE: Record<ScorableClaim['outcome'], number> = {
  true: 1,
  partial: 0.5,
  false: 0,
};

const HALF_LIFE_DAYS = 540;
const PRIOR_STRENGTH = 5;
const PRIOR_MEAN = 0.5;
const MS_PER_DAY = 86_400_000;

function recencyWeight(claimedAt: number, now: number): number {
  const ageDays = Math.max(0, (now - claimedAt) / MS_PER_DAY);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** Weighted 0–100 reliability score. With no claims this is the prior (50). */
export function reliabilityScore(claims: readonly ScorableClaim[], now: number): number {
  let weightedSum = PRIOR_MEAN * PRIOR_STRENGTH;
  let weightTotal = PRIOR_STRENGTH;
  for (const claim of claims) {
    const w = claim.confidence * recencyWeight(claim.claimedAt, now);
    weightedSum += w * OUTCOME_VALUE[claim.outcome];
    weightTotal += w;
  }
  return (100 * weightedSum) / weightTotal;
}

/** Unweighted accuracy in 0–1 (partial counts half); null with no claims. */
export function rawAccuracy(claims: readonly ScorableClaim[]): number | null {
  if (claims.length === 0) {
    return null;
  }
  const sum = claims.reduce((acc, c) => acc + OUTCOME_VALUE[c.outcome], 0);
  return sum / claims.length;
}

/**
 * Consecutive 'true' outcomes counting back from the most recent resolution.
 * 'partial' neither breaks nor extends; 'false' breaks.
 */
export function currentStreak(claims: readonly ScorableClaim[]): number {
  const ordered = [...claims].sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));
  let streak = 0;
  for (const claim of ordered) {
    if (claim.outcome === 'true') {
      streak++;
    } else if (claim.outcome === 'false') {
      break;
    }
  }
  return streak;
}

/** Full stat block for one journalist's resolved claims. */
export function computeStats(claims: readonly ScorableClaim[], now: number): JournalistStats {
  const score = reliabilityScore(claims, now);
  return {
    score,
    tier: tierForScore(score, claims.length),
    resolvedCount: claims.length,
    accuracy: rawAccuracy(claims),
    streak: currentStreak(claims),
  };
}

/**
 * Stats per journalist from a flat list of rows (as returned by the claims
 * repository's `listScoringRows`). Journalists with no resolved claims are
 * absent — callers fall back to `computeStats([], now)` semantics.
 */
export function computeStatsByJournalist<T extends ScorableClaim & { journalistId: string }>(
  rows: readonly T[],
  now: number,
): Map<string, JournalistStats> {
  const grouped = new Map<string, ScorableClaim[]>();
  for (const row of rows) {
    const list = grouped.get(row.journalistId);
    if (list) {
      list.push(row);
    } else {
      grouped.set(row.journalistId, [row]);
    }
  }
  const stats = new Map<string, JournalistStats>();
  for (const [journalistId, list] of grouped) {
    stats.set(journalistId, computeStats(list, now));
  }
  return stats;
}

export interface Scorecard {
  trueCount: number;
  partialCount: number;
  falseCount: number;
  total: number;
  /** "Correct" credit: true = 1, partial = ½. */
  correct: number;
  /** Same tally restricted to the recent window. */
  recent: { correct: number; total: number; windowDays: number };
  byConfidence: Record<ScorableClaim['confidence'], { correct: number; total: number }>;
}

const RECENT_WINDOW_DAYS = 365;

/** The "why" behind a score — plain counts a user can verify by hand. */
export function computeScorecard(claims: readonly ScorableClaim[], now: number): Scorecard {
  const card: Scorecard = {
    trueCount: 0,
    partialCount: 0,
    falseCount: 0,
    total: claims.length,
    correct: 0,
    recent: { correct: 0, total: 0, windowDays: RECENT_WINDOW_DAYS },
    byConfidence: {
      1: { correct: 0, total: 0 },
      2: { correct: 0, total: 0 },
      3: { correct: 0, total: 0 },
    },
  };
  const recentCutoff = now - RECENT_WINDOW_DAYS * MS_PER_DAY;
  for (const claim of claims) {
    const value = OUTCOME_VALUE[claim.outcome];
    if (claim.outcome === 'true') {
      card.trueCount++;
    } else if (claim.outcome === 'partial') {
      card.partialCount++;
    } else {
      card.falseCount++;
    }
    card.correct += value;
    card.byConfidence[claim.confidence].total++;
    card.byConfidence[claim.confidence].correct += value;
    if (claim.claimedAt >= recentCutoff) {
      card.recent.total++;
      card.recent.correct += value;
    }
  }
  return card;
}

/** How much one claim moved the journalist's score (shown after resolving). */
export function scoreImpact(
  allClaims: readonly ScorableClaim[],
  claim: ScorableClaim,
  now: number,
): number {
  const without = allClaims.filter((c) => c !== claim);
  return reliabilityScore(allClaims, now) - reliabilityScore(without, now);
}

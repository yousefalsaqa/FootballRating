/**
 * Scoring is pure and self-contained: it defines its own input shape rather
 * than importing repository types. `ScoringRow` from the claims repository is
 * structurally compatible.
 */

export type ScorableOutcome = 'true' | 'partial' | 'false';

/** 1 = speculative link, 2 = advanced/strong, 3 = confirmed ("here we go"). */
export type ScorableConfidence = 1 | 2 | 3;

export interface ScorableClaim {
  outcome: ScorableOutcome;
  confidence: ScorableConfidence;
  /** Epoch ms when the claim was made — drives recency decay. */
  claimedAt: number;
  /** Epoch ms when resolved — drives streak ordering. */
  resolvedAt: number | null;
}

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

export interface JournalistStats {
  /** 0–100 weighted reliability score. */
  score: number;
  /** null while unranked (fewer resolved claims than MIN_CLAIMS_FOR_TIER). */
  tier: Tier | null;
  resolvedCount: number;
  /** Unweighted share of correct outcomes (partial = half), null with no data. */
  accuracy: number | null;
  /** Consecutive 'true' outcomes, newest first; 'partial' skips, 'false' breaks. */
  streak: number;
}

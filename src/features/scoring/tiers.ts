import type { Tier } from '@/features/scoring/types';

/** Minimum resolved claims before a journalist is ranked at all. */
export const MIN_CLAIMS_FOR_TIER = 3;

const TIER_FLOORS: readonly { tier: Tier; floor: number }[] = [
  { tier: 'S', floor: 85 },
  { tier: 'A', floor: 75 },
  { tier: 'B', floor: 60 },
  { tier: 'C', floor: 45 },
  { tier: 'D', floor: 0 },
];

/** Maps a 0–100 score to a tier; null while below the ranking threshold. */
export function tierForScore(score: number, resolvedCount: number): Tier | null {
  if (resolvedCount < MIN_CLAIMS_FOR_TIER) {
    return null;
  }
  const match = TIER_FLOORS.find((t) => score >= t.floor);
  return match ? match.tier : 'D';
}

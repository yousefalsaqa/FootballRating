/** @jest-environment node */

import {
  computeScorecard,
  computeStats,
  computeStatsByJournalist,
  currentStreak,
  rawAccuracy,
  recentMovement,
  reliabilityScore,
  scoreImpact,
} from '@/features/scoring/engine';
import { MIN_CLAIMS_FOR_TIER, tierForScore } from '@/features/scoring/tiers';
import type { ScorableClaim, ScorableConfidence, ScorableOutcome } from '@/features/scoring/types';

const NOW = Date.UTC(2026, 6, 26);
const DAY = 86_400_000;

function claim(
  outcome: ScorableOutcome,
  overrides?: Partial<ScorableClaim> & { confidence?: ScorableConfidence },
): ScorableClaim {
  return {
    outcome,
    confidence: 2,
    claimedAt: NOW - 10 * DAY,
    resolvedAt: NOW - 5 * DAY,
    ...overrides,
  };
}

describe('reliabilityScore', () => {
  test('no claims returns the prior (50)', () => {
    expect(reliabilityScore([], NOW)).toBe(50);
  });

  test('all-true recent claims push score toward 100', () => {
    const claims = Array.from({ length: 20 }, () => claim('true', { confidence: 3 }));
    const score = reliabilityScore(claims, NOW);
    expect(score).toBeGreaterThan(90);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('all-false recent claims push score toward 0', () => {
    const claims = Array.from({ length: 20 }, () => claim('false', { confidence: 3 }));
    expect(reliabilityScore(claims, NOW)).toBeLessThan(10);
  });

  test('partial outcomes land at the prior mean', () => {
    const claims = Array.from({ length: 10 }, () => claim('partial'));
    expect(reliabilityScore(claims, NOW)).toBeCloseTo(50, 5);
  });

  test('Bayesian smoothing: 2-for-2 does not beat 45-for-50', () => {
    const twoForTwo = [claim('true'), claim('true')];
    const bigRecord = [
      ...Array.from({ length: 45 }, () => claim('true')),
      ...Array.from({ length: 5 }, () => claim('false')),
    ];
    expect(reliabilityScore(bigRecord, NOW)).toBeGreaterThan(reliabilityScore(twoForTwo, NOW));
  });

  test('wrong confirmed claim hurts more than wrong speculative claim', () => {
    const base = Array.from({ length: 10 }, () => claim('true'));
    const withConfirmedMiss = [...base, claim('false', { confidence: 3 })];
    const withSpeculativeMiss = [...base, claim('false', { confidence: 1 })];
    expect(reliabilityScore(withConfirmedMiss, NOW)).toBeLessThan(
      reliabilityScore(withSpeculativeMiss, NOW),
    );
  });

  test('old misses fade: recent record dominates an old identical miss', () => {
    const recentMiss = [claim('false', { claimedAt: NOW - 30 * DAY })];
    const oldMiss = [claim('false', { claimedAt: NOW - 1080 * DAY })];
    // Both scores sit below the prior, but the old miss has decayed toward it.
    expect(reliabilityScore(oldMiss, NOW)).toBeGreaterThan(reliabilityScore(recentMiss, NOW));
  });

  test('half-life: a claim 540 days old carries half the weight', () => {
    const fresh = [claim('true', { claimedAt: NOW })];
    const aged = [claim('true', { claimedAt: NOW - 540 * DAY })];
    const freshLift = reliabilityScore(fresh, NOW) - 50;
    const agedLift = reliabilityScore(aged, NOW) - 50;
    expect(agedLift).toBeLessThan(freshLift);
    expect(agedLift).toBeGreaterThan(0);
  });

  test('future claimedAt does not blow up (clamped to zero age)', () => {
    const claims = [claim('true', { claimedAt: NOW + 5 * DAY })];
    expect(reliabilityScore(claims, NOW)).toBeGreaterThan(50);
  });
});

describe('rawAccuracy', () => {
  test('null with no claims', () => {
    expect(rawAccuracy([])).toBeNull();
  });

  test('partial counts half', () => {
    expect(rawAccuracy([claim('true'), claim('false'), claim('partial'), claim('partial')])).toBe(
      0.5,
    );
  });
});

describe('currentStreak', () => {
  test('zero with no claims', () => {
    expect(currentStreak([])).toBe(0);
  });

  test('counts consecutive trues from the latest resolution', () => {
    const claims = [
      claim('false', { resolvedAt: NOW - 10 * DAY }),
      claim('true', { resolvedAt: NOW - 3 * DAY }),
      claim('true', { resolvedAt: NOW - 1 * DAY }),
    ];
    expect(currentStreak(claims)).toBe(2);
  });

  test('false breaks the streak', () => {
    const claims = [
      claim('true', { resolvedAt: NOW - 3 * DAY }),
      claim('false', { resolvedAt: NOW - 2 * DAY }),
      claim('true', { resolvedAt: NOW - 1 * DAY }),
    ];
    expect(currentStreak(claims)).toBe(1);
  });

  test('partial neither breaks nor extends', () => {
    const claims = [
      claim('true', { resolvedAt: NOW - 4 * DAY }),
      claim('partial', { resolvedAt: NOW - 2 * DAY }),
      claim('true', { resolvedAt: NOW - 1 * DAY }),
    ];
    expect(currentStreak(claims)).toBe(2);
  });

  test('all-false is a zero streak', () => {
    expect(currentStreak([claim('false'), claim('false')])).toBe(0);
  });
});

describe('tierForScore', () => {
  test('unranked below the claim minimum', () => {
    expect(tierForScore(95, MIN_CLAIMS_FOR_TIER - 1)).toBeNull();
  });

  test.each([
    [90, 'S'],
    [85, 'S'],
    [84.9, 'A'],
    [75, 'A'],
    [60, 'B'],
    [59.9, 'C'],
    [45, 'C'],
    [44.9, 'D'],
    [0, 'D'],
  ])('score %p → tier %p', (score, tier) => {
    expect(tierForScore(score as number, 10)).toBe(tier);
  });
});

describe('recentMovement', () => {
  test('zero when nothing resolved in the window', () => {
    const old = [claim('true', { resolvedAt: NOW - 90 * DAY })];
    expect(recentMovement(old, NOW)).toBe(0);
  });

  test('positive after a recent true, negative after a recent false', () => {
    const base = [claim('true', { resolvedAt: NOW - 90 * DAY })];
    expect(recentMovement([...base, claim('true', { resolvedAt: NOW - 2 * DAY })], NOW)).toBeGreaterThan(0);
    expect(recentMovement([...base, claim('false', { resolvedAt: NOW - 2 * DAY })], NOW)).toBeLessThan(0);
  });
});

describe('computeStats / computeStatsByJournalist', () => {
  test('assembles the full stat block', () => {
    const claims = [claim('true'), claim('true'), claim('partial')];
    const stats = computeStats(claims, NOW);
    expect(stats.resolvedCount).toBe(3);
    expect(stats.tier).not.toBeNull();
    expect(stats.accuracy).toBeCloseTo(5 / 6);
    expect(stats.streak).toBe(2);
    expect(stats.score).toBeGreaterThan(50);
    expect(stats.record).toEqual({ trueCount: 2, partialCount: 1, falseCount: 0 });
    expect(stats.movement).toBeGreaterThan(0);
  });

  test('groups rows by journalist', () => {
    const rows = [
      { ...claim('true'), journalistId: 'a' },
      { ...claim('true'), journalistId: 'a' },
      { ...claim('false'), journalistId: 'b' },
    ];
    const map = computeStatsByJournalist(rows, NOW);
    expect(map.size).toBe(2);
    expect(map.get('a')?.resolvedCount).toBe(2);
    expect(map.get('a')!.score).toBeGreaterThan(map.get('b')!.score);
    expect(map.get('missing')).toBeUndefined();
  });
});

describe('computeScorecard', () => {
  test('empty input yields a zeroed card', () => {
    const card = computeScorecard([], NOW);
    expect(card.total).toBe(0);
    expect(card.correct).toBe(0);
    expect(card.recent.total).toBe(0);
  });

  test('tallies outcomes with partial as half credit', () => {
    const card = computeScorecard(
      [claim('true'), claim('true'), claim('partial'), claim('false')],
      NOW,
    );
    expect(card).toMatchObject({ trueCount: 2, partialCount: 1, falseCount: 1, total: 4 });
    expect(card.correct).toBe(2.5);
  });

  test('recent window only counts claims inside 365 days', () => {
    const card = computeScorecard(
      [
        claim('true', { claimedAt: NOW - 10 * DAY }),
        claim('false', { claimedAt: NOW - 400 * DAY }),
      ],
      NOW,
    );
    expect(card.total).toBe(2);
    expect(card.recent.total).toBe(1);
    expect(card.recent.correct).toBe(1);
  });

  test('groups by confidence tier', () => {
    const card = computeScorecard(
      [
        claim('true', { confidence: 3 }),
        claim('false', { confidence: 3 }),
        claim('true', { confidence: 1 }),
      ],
      NOW,
    );
    expect(card.byConfidence[3]).toEqual({ correct: 1, total: 2 });
    expect(card.byConfidence[1]).toEqual({ correct: 1, total: 1 });
    expect(card.byConfidence[2]).toEqual({ correct: 0, total: 0 });
  });
});

describe('scoreImpact', () => {
  test('a true resolution moves the score up', () => {
    const resolved = claim('true');
    const all = [claim('true'), claim('false'), resolved];
    expect(scoreImpact(all, resolved, NOW)).toBeGreaterThan(0);
  });

  test('a false resolution moves the score down', () => {
    const resolved = claim('false');
    const all = [claim('true'), claim('true'), resolved];
    expect(scoreImpact(all, resolved, NOW)).toBeLessThan(0);
  });
});

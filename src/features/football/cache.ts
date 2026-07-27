import { eq, lt, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { apiCache, apiUsage } from '@/db/schema';

/**
 * SQLite-backed response cache + daily request budget for the football API.
 * The free tier allows ~100 requests/day; we stop calling out at SOFT_LIMIT
 * and fall back to cache + manual entry.
 */

export const DAILY_BUDGET = 100;
export const SOFT_LIMIT = 90;

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export async function getCached(cacheKey: string, now: number): Promise<unknown | null> {
  const rows = await db.select().from(apiCache).where(eq(apiCache.cacheKey, cacheKey)).limit(1);
  const hit = rows[0];
  if (!hit || hit.expiresAt <= now) {
    return null;
  }
  return JSON.parse(hit.payload);
}

export async function setCached(
  cacheKey: string,
  payload: unknown,
  ttlMs: number,
  now: number,
): Promise<void> {
  await db
    .insert(apiCache)
    .values({ cacheKey, payload: JSON.stringify(payload), fetchedAt: now, expiresAt: now + ttlMs })
    .onConflictDoUpdate({
      target: apiCache.cacheKey,
      set: { payload: JSON.stringify(payload), fetchedAt: now, expiresAt: now + ttlMs },
    });
}

/** Drop expired entries — called opportunistically, not on a schedule. */
export async function pruneExpired(now: number): Promise<void> {
  await db.delete(apiCache).where(lt(apiCache.expiresAt, now));
}

export async function getTodayUsage(now: number): Promise<number> {
  const rows = await db.select().from(apiUsage).where(eq(apiUsage.day, dayKey(now))).limit(1);
  return rows[0]?.requestCount ?? 0;
}

/** Atomically counts one real network request against today's budget. */
export async function incrementUsage(now: number): Promise<void> {
  await db
    .insert(apiUsage)
    .values({ day: dayKey(now), requestCount: 1 })
    .onConflictDoUpdate({
      target: apiUsage.day,
      set: { requestCount: sql`${apiUsage.requestCount} + 1` },
    });
}

export async function isBudgetExhausted(now: number): Promise<boolean> {
  return (await getTodayUsage(now)) >= SOFT_LIMIT;
}

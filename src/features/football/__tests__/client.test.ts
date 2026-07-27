/** @jest-environment node */

jest.mock('@/db/client', () => {
  const { createClient } = require('@libsql/client');
  const { drizzle } = require('drizzle-orm/libsql');
  const schema = require('@/db/schema');
  const client = createClient({ url: ':memory:' });
  return { db: drizzle(client, { schema }), __client: client };
});

import { z } from 'zod';

import { migrate } from 'drizzle-orm/libsql/migrator';

import { db } from '@/db/client';
import { apiUsage } from '@/db/schema';
import {
  dayKey,
  getCached,
  getTodayUsage,
  incrementUsage,
  isBudgetExhausted,
  setCached,
  SOFT_LIMIT,
} from '@/features/football/cache';
import { apiGet, cacheKeyFor } from '@/features/football/client';

const NOW = Date.UTC(2026, 6, 26, 12);
const HOUR = 3_600_000;
const itemSchema = z.object({ id: z.number() });

function mockFetchOnce(body: unknown, ok = true) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(body),
  });
}

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: 'src/db/migrations' });
});

beforeEach(async () => {
  global.fetch = jest.fn();
  process.env.EXPO_PUBLIC_API_FOOTBALL_KEY = 'test-key';
  await db.delete(apiUsage);
});

describe('cache', () => {
  test('round-trips within TTL and expires after it', async () => {
    await setCached('k1', { hello: 1 }, HOUR, NOW);
    expect(await getCached('k1', NOW + HOUR - 1)).toEqual({ hello: 1 });
    expect(await getCached('k1', NOW + HOUR)).toBeNull();
  });

  test('overwrites an existing key', async () => {
    await setCached('k2', { v: 1 }, HOUR, NOW);
    await setCached('k2', { v: 2 }, HOUR, NOW);
    expect(await getCached('k2', NOW)).toEqual({ v: 2 });
  });

  test('usage counts per day and resets across days', async () => {
    await incrementUsage(NOW);
    await incrementUsage(NOW);
    expect(await getTodayUsage(NOW)).toBe(2);
    expect(await getTodayUsage(NOW + 24 * HOUR)).toBe(0);
    expect(dayKey(NOW)).toBe('2026-07-26');
  });

  test('budget exhausts at the soft limit', async () => {
    for (let i = 0; i < SOFT_LIMIT; i++) {
      await incrementUsage(NOW);
    }
    expect(await isBudgetExhausted(NOW)).toBe(true);
    expect(await isBudgetExhausted(NOW + 24 * HOUR)).toBe(false);
  });
});

describe('apiGet', () => {
  test('cache key is normalized and order-independent', () => {
    expect(cacheKeyFor('/teams', { search: 'Liverpool' })).toBe('/teams?search=liverpool');
    expect(cacheKeyFor('/x', { b: 'B', a: 'A' })).toBe(cacheKeyFor('/x', { a: 'a', b: 'b' }));
  });

  test('network fetch parses, caches, and counts usage', async () => {
    mockFetchOnce({ response: [{ id: 7 }] });
    const result = await apiGet('/t1', { q: 'x' }, itemSchema, HOUR, NOW);
    expect(result).toEqual({ ok: true, data: [{ id: 7 }], fromCache: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(await getTodayUsage(NOW)).toBe(1);

    // Second call within TTL hits cache: no fetch, no usage.
    const cached = await apiGet('/t1', { q: 'x' }, itemSchema, HOUR, NOW + 1);
    expect(cached).toEqual({ ok: true, data: [{ id: 7 }], fromCache: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(await getTodayUsage(NOW)).toBe(1);
  });

  test('exhausted budget blocks network but not cache', async () => {
    mockFetchOnce({ response: [{ id: 1 }] });
    await apiGet('/t2', { q: 'cached' }, itemSchema, HOUR, NOW);
    for (let i = 0; i < SOFT_LIMIT; i++) {
      await incrementUsage(NOW);
    }
    // Cached query still answers.
    const cached = await apiGet('/t2', { q: 'cached' }, itemSchema, HOUR, NOW);
    expect(cached.ok).toBe(true);
    // Uncached query refuses to spend.
    const blocked = await apiGet('/t2', { q: 'fresh' }, itemSchema, HOUR, NOW);
    expect(blocked).toEqual({ ok: false, reason: 'budget' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('malformed payload is a parse failure and is not cached', async () => {
    mockFetchOnce({ nope: true });
    expect(await apiGet('/t3', { q: 'x' }, itemSchema, HOUR, NOW)).toEqual({
      ok: false,
      reason: 'parse',
    });
    mockFetchOnce({ response: [{ id: 2 }] });
    const retry = await apiGet('/t3', { q: 'x' }, itemSchema, HOUR, NOW);
    expect(retry.ok).toBe(true);
  });

  test('HTTP error and thrown fetch are network failures', async () => {
    mockFetchOnce({}, false);
    expect(await apiGet('/t4', { q: 'a' }, itemSchema, HOUR, NOW)).toEqual({
      ok: false,
      reason: 'network',
    });
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    expect(await apiGet('/t4', { q: 'b' }, itemSchema, HOUR, NOW)).toEqual({
      ok: false,
      reason: 'network',
    });
  });

  test('missing key fails closed without fetching', async () => {
    delete process.env.EXPO_PUBLIC_API_FOOTBALL_KEY;
    expect(await apiGet('/t5', { q: 'x' }, itemSchema, HOUR, NOW)).toEqual({
      ok: false,
      reason: 'missing-key',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

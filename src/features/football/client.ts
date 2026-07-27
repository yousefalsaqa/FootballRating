import type { z } from 'zod';

import {
  getCached,
  incrementUsage,
  isBudgetExhausted,
  setCached,
} from '@/features/football/cache';
import { apiEnvelope, type ApiResult } from '@/features/football/types';

/**
 * The single gateway to api-sports.io. Order of defense:
 *   cache → budget check → network (10 s timeout) → zod parse → cache write.
 * Swapping in a server proxy later means changing only this file.
 */

const BASE_URL = 'https://v3.football.api-sports.io';
const TIMEOUT_MS = 10_000;

function apiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_API_FOOTBALL_KEY;
}

export function cacheKeyFor(path: string, params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]?.toLowerCase()}`)
    .join('&');
  return `${path}?${sorted}`;
}

export async function apiGet<T extends z.ZodType>(
  path: string,
  params: Record<string, string>,
  itemSchema: T,
  ttlMs: number,
  now = Date.now(),
): Promise<ApiResult<z.infer<T>[]>> {
  const key = apiKey();
  const cacheKey = cacheKeyFor(path, params);
  const envelope = apiEnvelope(itemSchema);

  const cached = await getCached(cacheKey, now);
  if (cached !== null) {
    const parsed = envelope.safeParse(cached);
    if (parsed.success) {
      return { ok: true, data: parsed.data.response, fromCache: true };
    }
  }

  if (!key) {
    return { ok: false, reason: 'missing-key' };
  }
  if (await isBudgetExhausted(now)) {
    return { ok: false, reason: 'budget' };
  }

  let body: unknown;
  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${BASE_URL}${path}?${query}`, {
      headers: { 'x-apisports-key': key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await incrementUsage(now);
    if (!response.ok) {
      return { ok: false, reason: 'network' };
    }
    body = await response.json();
  } catch {
    return { ok: false, reason: 'network' };
  }

  const parsed = envelope.safeParse(body);
  if (!parsed.success) {
    return { ok: false, reason: 'parse' };
  }
  await setCached(cacheKey, body, ttlMs, now);
  return { ok: true, data: parsed.data.response, fromCache: false };
}

import { z } from 'zod';

/** Zod schemas for the api-sports.io (API-Football v3) payloads we consume. */

/**
 * Every v3 endpoint wraps results in this envelope. api-sports signals rate
 * limits / bad keys / bad params with HTTP 200 + a populated `errors` field —
 * `[]` when clean, an object of messages when errored.
 */
export function apiEnvelope<T extends z.ZodType>(item: T) {
  return z.object({
    response: z.array(item),
    errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  });
}

export function envelopeHasErrors(errors: unknown[] | Record<string, unknown> | undefined): boolean {
  if (!errors) {
    return false;
  }
  return Array.isArray(errors) ? errors.length > 0 : Object.keys(errors).length > 0;
}

export const playerProfileSchema = z.object({
  player: z.object({
    id: z.number(),
    name: z.string(),
    firstname: z.string().nullish(),
    lastname: z.string().nullish(),
    nationality: z.string().nullish(),
    photo: z.string().nullish(),
  }),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

export const teamResultSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    country: z.string().nullish(),
    logo: z.string().nullish(),
  }),
});
export type TeamResult = z.infer<typeof teamResultSchema>;

export const transferRecordSchema = z.object({
  player: z.object({ id: z.number(), name: z.string() }),
  transfers: z.array(
    z.object({
      date: z.string(),
      type: z.string().nullish(),
      teams: z.object({
        in: z.object({ id: z.number().nullish(), name: z.string().nullish() }),
        out: z.object({ id: z.number().nullish(), name: z.string().nullish() }),
      }),
    }),
  ),
});
export type TransferRecord = z.infer<typeof transferRecordSchema>;

/** Discriminated result so screens can degrade gracefully without throwing. */
export type ApiResult<T> =
  | { ok: true; data: T; fromCache: boolean }
  | { ok: false; reason: ApiFailureReason };

export type ApiFailureReason = 'budget' | 'network' | 'parse' | 'missing-key' | 'api-error';

/** Thrown by query hooks so TanStack Query never caches a failure as data. */
export class ApiFailureError extends Error {
  constructor(public readonly reason: ApiFailureReason) {
    super(`Football API failure: ${reason}`);
    this.name = 'ApiFailureError';
  }
}

export function failureReasonOf(error: unknown): ApiFailureReason | undefined {
  return error instanceof ApiFailureError ? error.reason : undefined;
}

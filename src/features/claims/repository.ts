import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  claimTags,
  claims,
  tags,
  type Claim,
  type ClaimOutcome,
  type NewClaim,
  type Tag,
} from '@/db/schema';
import { newId } from '@/lib/id';

/** All claim + tag persistence lives here — no queries elsewhere. */

export interface ClaimFilter {
  status?: 'pending' | 'resolved';
  journalistId?: string;
}

export async function listClaims(filter?: ClaimFilter): Promise<Claim[]> {
  const conditions = [
    filter?.status ? eq(claims.status, filter.status) : undefined,
    filter?.journalistId ? eq(claims.journalistId, filter.journalistId) : undefined,
  ].filter((c) => c !== undefined);
  return db
    .select()
    .from(claims)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(claims.claimedAt));
}

export async function getClaim(id: string): Promise<Claim | undefined> {
  const rows = await db.select().from(claims).where(eq(claims.id, id)).limit(1);
  return rows[0];
}

export async function getClaimTags(claimId: string): Promise<Tag[]> {
  return db
    .select({ id: tags.id, name: tags.name })
    .from(claimTags)
    .innerJoin(tags, eq(claimTags.tagId, tags.id))
    .where(eq(claimTags.claimId, claimId));
}

export type CreateClaimInput = Omit<
  NewClaim,
  'id' | 'status' | 'outcome' | 'resolvedAt' | 'createdAt'
>;

export async function createClaim(input: CreateClaimInput, tagNames: string[] = []): Promise<Claim> {
  const id = newId();
  const now = Date.now();
  await db.insert(claims).values({ ...input, id, createdAt: now });
  if (tagNames.length) {
    const tagIds = await upsertTags(tagNames);
    await db.insert(claimTags).values(tagIds.map((tagId) => ({ claimId: id, tagId })));
  }
  const created = await getClaim(id);
  if (!created) {
    throw new Error('Claim insert failed');
  }
  return created;
}

export async function resolveClaim(id: string, outcome: ClaimOutcome): Promise<void> {
  await db
    .update(claims)
    .set({ status: 'resolved', outcome, resolvedAt: Date.now() })
    .where(eq(claims.id, id));
}

/** Undo a resolution, returning the claim to pending. */
export async function reopenClaim(id: string): Promise<void> {
  await db
    .update(claims)
    .set({ status: 'pending', outcome: null, resolvedAt: null })
    .where(eq(claims.id, id));
}

export async function deleteClaim(id: string): Promise<void> {
  await db.delete(claims).where(eq(claims.id, id));
}

/** Slim resolved-claim rows for the scoring engine — keep this query cheap. */
export interface ScoringRow {
  journalistId: string;
  outcome: ClaimOutcome;
  confidence: Claim['confidence'];
  claimedAt: number;
  resolvedAt: number | null;
}

export async function listScoringRows(): Promise<ScoringRow[]> {
  const rows = await db
    .select({
      journalistId: claims.journalistId,
      outcome: claims.outcome,
      confidence: claims.confidence,
      claimedAt: claims.claimedAt,
      resolvedAt: claims.resolvedAt,
    })
    .from(claims)
    .where(eq(claims.status, 'resolved'));
  return rows.filter((r): r is ScoringRow => r.outcome !== null);
}

export async function listTags(): Promise<Tag[]> {
  return db.select().from(tags).orderBy(tags.name);
}

async function upsertTags(names: string[]): Promise<string[]> {
  const normalized = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
  if (!normalized.length) {
    return [];
  }
  const existing = await db.select().from(tags).where(inArray(tags.name, normalized));
  const existingByName = new Map(existing.map((t) => [t.name, t.id]));
  const missing = normalized.filter((n) => !existingByName.has(n));
  if (missing.length) {
    const newRows = missing.map((name) => ({ id: newId(), name }));
    await db.insert(tags).values(newRows);
    for (const row of newRows) {
      existingByName.set(row.name, row.id);
    }
  }
  return normalized.map((n) => existingByName.get(n) as string);
}

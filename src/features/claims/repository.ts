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

/**
 * Canonical story identity — one journalist reporting one player to one
 * destination within one window is ONE claim, however many articles cover it.
 */
export function claimStoryKey(
  claim: Pick<Claim, 'journalistId' | 'playerName' | 'toClubName' | 'transferWindow'>,
): string {
  return [
    claim.journalistId,
    claim.playerName.trim().toLowerCase(),
    claim.toClubName.trim().toLowerCase(),
    claim.transferWindow,
  ].join('|');
}

/** The moment of the last deliberate verdict/overrule on a claim. */
function editorialActionAt(claim: Claim): number {
  return Math.max(claim.resolvedAt ?? 0, claim.reopenedAt ?? 0);
}

/**
 * Deletes duplicate filings of the same story (see claimStoryKey). The copy
 * with the LATEST editorial action wins (a fresh reopen beats an older
 * verdict); with no actions anywhere, a resolved copy beats pending, else the
 * earliest filing stays. Duplicates crept in when auto-file's seen-list reset
 * between sessions; the claims table itself is now the dedupe authority.
 */
export async function deleteDuplicateClaims(): Promise<number> {
  const all = await db.select().from(claims).orderBy(claims.createdAt);
  const keep = new Map<string, Claim>();
  const doomed: string[] = [];
  for (const claim of all) {
    const key = claimStoryKey(claim);
    const kept = keep.get(key);
    if (!kept) {
      keep.set(key, claim);
    } else if (
      editorialActionAt(claim) > editorialActionAt(kept) ||
      (editorialActionAt(claim) === editorialActionAt(kept) &&
        kept.status === 'pending' &&
        claim.status === 'resolved')
    ) {
      doomed.push(kept.id);
      keep.set(key, claim);
    } else {
      doomed.push(claim.id);
    }
  }
  if (doomed.length) {
    await db.delete(claimTags).where(inArray(claimTags.claimId, doomed));
    await db.delete(claims).where(inArray(claims.id, doomed));
  }
  return doomed.length;
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

export interface ResolutionEvidence {
  /** One-sentence explanation of the verdict. */
  note?: string | null;
  /** Coverage that decided it. */
  sourceUrl?: string | null;
}

export async function resolveClaim(
  id: string,
  outcome: ClaimOutcome,
  evidence?: ResolutionEvidence,
): Promise<void> {
  await db
    .update(claims)
    .set({
      status: 'resolved',
      outcome,
      resolvedAt: Date.now(),
      resolutionNote: evidence?.note ?? null,
      resolutionSourceUrl: evidence?.sourceUrl ?? null,
      reopenedAt: null,
    })
    .where(eq(claims.id, id));
}

/**
 * Undo a resolution, returning the claim to pending. Stamps `reopenedAt` so
 * the overrule sticks: auto-resolve leaves it alone and sync won't let the
 * old verdict come back.
 */
export async function reopenClaim(id: string): Promise<void> {
  await db
    .update(claims)
    .set({
      status: 'pending',
      outcome: null,
      resolvedAt: null,
      resolutionNote: null,
      resolutionSourceUrl: null,
      reopenedAt: Date.now(),
    })
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

/** Total filed claims (any status) per journalist — for table sample sizes. */
export async function listClaimCountsByJournalist(): Promise<Map<string, number>> {
  const rows = await db.select({ journalistId: claims.journalistId }).from(claims);
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.journalistId, (counts.get(row.journalistId) ?? 0) + 1);
  }
  return counts;
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

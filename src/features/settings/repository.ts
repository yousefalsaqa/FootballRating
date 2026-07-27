import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { claimTags, claims, journalists, tags } from '@/db/schema';

/**
 * Whole-database export/import for the local-first escape hatch.
 * The snapshot schema is versioned so future shapes can migrate old files.
 */

const journalistSnapshot = z.object({
  id: z.string(),
  name: z.string(),
  outlet: z.string().nullable(),
  avatarColor: z.string(),
  isSeeded: z.boolean(),
  createdAt: z.number(),
  archivedAt: z.number().nullable(),
});

const claimSnapshot = z.object({
  id: z.string(),
  journalistId: z.string(),
  headline: z.string(),
  playerName: z.string(),
  playerApiId: z.number().nullable(),
  fromClubName: z.string().nullable(),
  fromClubApiId: z.number().nullable(),
  toClubName: z.string(),
  toClubApiId: z.number().nullable(),
  league: z.string().nullable(),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  transferWindow: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  notes: z.string().nullable(),
  claimedAt: z.number(),
  status: z.enum(['pending', 'resolved']),
  outcome: z.enum(['true', 'partial', 'false']).nullable(),
  resolvedAt: z.number().nullable(),
  createdAt: z.number(),
});

export const exportSnapshotSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  journalists: z.array(journalistSnapshot),
  claims: z.array(claimSnapshot),
  tags: z.array(z.object({ id: z.string(), name: z.string() })),
  claimTags: z.array(z.object({ claimId: z.string(), tagId: z.string() })),
});

export type ExportSnapshot = z.infer<typeof exportSnapshotSchema>;

export async function exportSnapshot(now: number): Promise<ExportSnapshot> {
  return {
    version: 1,
    exportedAt: now,
    journalists: await db.select().from(journalists),
    claims: await db.select().from(claims),
    tags: await db.select().from(tags),
    claimTags: await db.select().from(claimTags),
  };
}

export interface ImportResult {
  journalists: number;
  claims: number;
}

/**
 * Merges a snapshot into the current database. Existing rows (by id) are kept —
 * import never overwrites or deletes local data.
 */
export async function importSnapshot(snapshot: ExportSnapshot): Promise<ImportResult> {
  const existingJournalists = new Set(
    (await db.select({ id: journalists.id }).from(journalists)).map((r) => r.id),
  );
  const newJournalists = snapshot.journalists.filter((j) => !existingJournalists.has(j.id));
  if (newJournalists.length) {
    await db.insert(journalists).values(newJournalists);
  }

  const existingClaims = new Set((await db.select({ id: claims.id }).from(claims)).map((r) => r.id));
  const knownJournalists = new Set([...existingJournalists, ...newJournalists.map((j) => j.id)]);
  const newClaims = snapshot.claims.filter(
    (c) => !existingClaims.has(c.id) && knownJournalists.has(c.journalistId),
  );
  if (newClaims.length) {
    await db.insert(claims).values(newClaims);
  }

  const existingTags = new Set((await db.select({ id: tags.id }).from(tags)).map((r) => r.id));
  const existingTagNames = new Set((await db.select({ name: tags.name }).from(tags)).map((r) => r.name));
  const newTags = snapshot.tags.filter((t) => !existingTags.has(t.id) && !existingTagNames.has(t.name));
  if (newTags.length) {
    await db.insert(tags).values(newTags);
  }

  const validClaimIds = new Set([...existingClaims, ...newClaims.map((c) => c.id)]);
  const validTagIds = new Set([...existingTags, ...newTags.map((t) => t.id)]);
  const candidateLinks = snapshot.claimTags.filter(
    (link) => validClaimIds.has(link.claimId) && validTagIds.has(link.tagId),
  );
  if (candidateLinks.length) {
    const existingLinks = await db
      .select()
      .from(claimTags)
      .where(inArray(claimTags.claimId, [...new Set(candidateLinks.map((l) => l.claimId))]));
    const linkKey = (l: { claimId: string; tagId: string }) => `${l.claimId}:${l.tagId}`;
    const existingLinkKeys = new Set(existingLinks.map(linkKey));
    const newLinks = candidateLinks.filter((l) => !existingLinkKeys.has(linkKey(l)));
    if (newLinks.length) {
      await db.insert(claimTags).values(newLinks);
    }
  }

  return { journalists: newJournalists.length, claims: newClaims.length };
}

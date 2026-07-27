import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { claimTags, claims, journalists, tags } from '@/db/schema';

/**
 * Whole-database export/import for the local-first escape hatch.
 * The snapshot schema is versioned so future shapes can migrate old files.
 * Import merges by id first, then by name (journalists, tags) — ids are
 * per-device UUIDs, so name identity is what makes cross-device merges work.
 */

const journalistSnapshot = z.object({
  id: z.string(),
  name: z.string(),
  outlet: z.string().nullable(),
  handle: z.string().nullable().optional().default(null),
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
  resolutionNote: z.string().nullable().optional().default(null),
  resolutionSourceUrl: z.string().nullable().optional().default(null),
  reopenedAt: z.number().nullable().optional().default(null),
  deletedAt: z.number().nullable().optional().default(null),
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
  /** Local pending claims that received a resolution from the snapshot. */
  resolutions: number;
}

/** Merges a snapshot into the current database. Never overwrites local data. */
export async function importSnapshot(snapshot: ExportSnapshot): Promise<ImportResult> {
  // Journalists: same id or same name → same journalist (remap the id).
  const localJournalists = await db.select().from(journalists);
  const localJournalistIds = new Set(localJournalists.map((j) => j.id));
  const localJournalistIdByName = new Map(localJournalists.map((j) => [j.name, j.id]));
  const localHandles = new Set(localJournalists.map((j) => j.handle).filter(Boolean));
  const journalistIdRemap = new Map<string, string>();
  const newJournalists: typeof snapshot.journalists = [];
  for (const j of snapshot.journalists) {
    if (localJournalistIds.has(j.id)) {
      continue;
    }
    const idWithSameName = localJournalistIdByName.get(j.name);
    if (idWithSameName) {
      journalistIdRemap.set(j.id, idWithSameName);
      continue;
    }
    // Drop a handle that already belongs to a different local journalist.
    const handle = j.handle && !localHandles.has(j.handle) ? j.handle : null;
    if (handle) {
      localHandles.add(handle);
    }
    newJournalists.push({ ...j, handle });
    localJournalistIds.add(j.id);
    localJournalistIdByName.set(j.name, j.id);
  }
  if (newJournalists.length) {
    await db.insert(journalists).values(newJournalists);
  }

  // Claims: new ids only, journalist id remapped where it merged by name.
  const localClaimRows = await db
    .select({
      id: claims.id,
      status: claims.status,
      resolvedAt: claims.resolvedAt,
      reopenedAt: claims.reopenedAt,
      deletedAt: claims.deletedAt,
    })
    .from(claims);
  const existingClaims = new Set(localClaimRows.map((r) => r.id));
  const newClaims = snapshot.claims
    .map((c) => ({ ...c, journalistId: journalistIdRemap.get(c.journalistId) ?? c.journalistId }))
    .filter((c) => !existingClaims.has(c.id) && localJournalistIds.has(c.journalistId));
  if (newClaims.length) {
    await db.insert(claims).values(newClaims);
  }

  // Editorial state propagates between same-id copies: whichever side acted
  // LAST wins — a newer verdict overwrites, a newer reopen un-resolves, and a
  // newer deletion tombstones (the editor's action must never be undone by
  // the other device pushing older state back).
  const actionAt = (row: {
    resolvedAt: number | null;
    reopenedAt: number | null;
    deletedAt: number | null;
  }) => Math.max(row.resolvedAt ?? 0, row.reopenedAt ?? 0, row.deletedAt ?? 0);
  const localById = new Map(localClaimRows.map((r) => [r.id, r]));
  let resolutions = 0;
  for (const c of snapshot.claims) {
    const local = localById.get(c.id);
    if (!local || actionAt(c) <= actionAt(local)) {
      continue;
    }
    if (c.deletedAt) {
      await db.update(claims).set({ deletedAt: c.deletedAt }).where(eq(claims.id, c.id));
      resolutions += 1;
    } else if (c.status === 'resolved' && c.outcome) {
      await db
        .update(claims)
        .set({
          status: 'resolved',
          outcome: c.outcome,
          resolvedAt: c.resolvedAt ?? c.claimedAt,
          resolutionNote: c.resolutionNote,
          resolutionSourceUrl: c.resolutionSourceUrl,
          reopenedAt: null,
          deletedAt: null,
        })
        .where(eq(claims.id, c.id));
      resolutions += 1;
    } else if (c.status === 'pending' && c.reopenedAt) {
      await db
        .update(claims)
        .set({
          status: 'pending',
          outcome: null,
          resolvedAt: null,
          resolutionNote: null,
          resolutionSourceUrl: null,
          reopenedAt: c.reopenedAt,
          deletedAt: null,
        })
        .where(eq(claims.id, c.id));
      resolutions += 1;
    }
  }

  // Tags: same id or same (unique) name → same tag; remap link ids accordingly.
  const localTags = await db.select().from(tags);
  const localTagIds = new Set(localTags.map((t) => t.id));
  const localTagIdByName = new Map(localTags.map((t) => [t.name, t.id]));
  const tagIdRemap = new Map<string, string>();
  const newTags: typeof snapshot.tags = [];
  for (const t of snapshot.tags) {
    if (localTagIds.has(t.id)) {
      continue;
    }
    const idWithSameName = localTagIdByName.get(t.name);
    if (idWithSameName) {
      tagIdRemap.set(t.id, idWithSameName);
      continue;
    }
    newTags.push(t);
    localTagIds.add(t.id);
    localTagIdByName.set(t.name, t.id);
  }
  if (newTags.length) {
    await db.insert(tags).values(newTags);
  }

  // Links: remap tag ids, keep only links whose both ends exist, skip dupes.
  const validClaimIds = new Set([...existingClaims, ...newClaims.map((c) => c.id)]);
  const candidateLinks = snapshot.claimTags
    .map((l) => ({ claimId: l.claimId, tagId: tagIdRemap.get(l.tagId) ?? l.tagId }))
    .filter((l) => validClaimIds.has(l.claimId) && localTagIds.has(l.tagId));
  if (candidateLinks.length) {
    const existingLinks = await db
      .select()
      .from(claimTags)
      .where(inArray(claimTags.claimId, [...new Set(candidateLinks.map((l) => l.claimId))]));
    const linkKey = (l: { claimId: string; tagId: string }) => `${l.claimId}:${l.tagId}`;
    const seenLinks = new Set(existingLinks.map(linkKey));
    const newLinks = candidateLinks.filter((l) => {
      if (seenLinks.has(linkKey(l))) {
        return false;
      }
      seenLinks.add(linkKey(l));
      return true;
    });
    if (newLinks.length) {
      await db.insert(claimTags).values(newLinks);
    }
  }

  return { journalists: newJournalists.length, claims: newClaims.length, resolutions };
}

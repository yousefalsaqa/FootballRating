import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { appMeta, journalists } from '@/db/schema';
import { avatarColorFor } from '@/lib/constants';

const SEED_FLAG = 'seeded.journalists.v1';
const HANDLE_BACKFILL_FLAG = 'seeded.handles.v2';

/**
 * Seed ids are FIXED strings (not per-install UUIDs) so exports from one
 * device merge cleanly into another instead of duplicating the seeded rows.
 */
const SEED_JOURNALISTS: { id: string; name: string; outlet: string; handle: string }[] = [
  { id: 'seed-fabrizio-romano', name: 'Fabrizio Romano', outlet: 'Independent', handle: 'fabrizioromano' },
  { id: 'seed-david-ornstein', name: 'David Ornstein', outlet: 'The Athletic', handle: 'david_ornstein' },
  { id: 'seed-florian-plettenberg', name: 'Florian Plettenberg', outlet: 'Sky Sport DE', handle: 'plettigoal' },
  { id: 'seed-gianluca-di-marzio', name: 'Gianluca Di Marzio', outlet: 'Sky Sport IT', handle: 'dimarzio' },
  { id: 'seed-christian-falk', name: 'Christian Falk', outlet: 'BILD', handle: 'cfbayern' },
  { id: 'seed-matteo-moretto', name: 'Matteo Moretto', outlet: 'Relevo', handle: 'mattemoretto' },
  { id: 'seed-ben-jacobs', name: 'Ben Jacobs', outlet: 'talkSPORT', handle: 'jacobsben' },
];

/** Inserts well-known journalists on first launch. Idempotent via app_meta flags. */
export async function seedIfNeeded(): Promise<void> {
  const now = Date.now();
  const flag = await db.query.appMeta.findFirst({
    where: (meta, { eq: equals }) => equals(meta.key, SEED_FLAG),
  });
  if (!flag) {
    await db.insert(journalists).values(
      SEED_JOURNALISTS.map((j) => ({
        ...j,
        avatarColor: avatarColorFor(j.name),
        isSeeded: true,
        createdAt: now,
      })),
    );
    await db.insert(appMeta).values({ key: SEED_FLAG, value: new Date(now).toISOString() });
  }
  await backfillHandlesIfNeeded(now);
}

/** Databases seeded before the handle column existed get handles by name. */
async function backfillHandlesIfNeeded(now: number): Promise<void> {
  const flag = await db.query.appMeta.findFirst({
    where: (meta, { eq: equals }) => equals(meta.key, HANDLE_BACKFILL_FLAG),
  });
  if (flag) {
    return;
  }
  for (const seed of SEED_JOURNALISTS) {
    try {
      await db
        .update(journalists)
        .set({ handle: seed.handle })
        .where(and(eq(journalists.name, seed.name), isNull(journalists.handle)));
    } catch {
      // Handle already taken by a user-created journalist — leave theirs.
    }
  }
  await db.insert(appMeta).values({ key: HANDLE_BACKFILL_FLAG, value: new Date(now).toISOString() });
}

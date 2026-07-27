import { db } from '@/db/client';
import { appMeta, journalists } from '@/db/schema';
import { avatarColorFor } from '@/lib/constants';
import { newId } from '@/lib/id';

const SEED_FLAG = 'seeded.journalists.v1';

const SEED_JOURNALISTS: { name: string; outlet: string }[] = [
  { name: 'Fabrizio Romano', outlet: 'Independent' },
  { name: 'David Ornstein', outlet: 'The Athletic' },
  { name: 'Florian Plettenberg', outlet: 'Sky Sport DE' },
  { name: 'Gianluca Di Marzio', outlet: 'Sky Sport IT' },
  { name: 'Christian Falk', outlet: 'BILD' },
  { name: 'Matteo Moretto', outlet: 'Relevo' },
  { name: 'Ben Jacobs', outlet: 'talkSPORT' },
];

/** Inserts well-known journalists on first launch. Idempotent via app_meta flag. */
export async function seedIfNeeded(): Promise<void> {
  const flag = await db.query.appMeta.findFirst({
    where: (meta, { eq }) => eq(meta.key, SEED_FLAG),
  });
  if (flag) {
    return;
  }
  const now = Date.now();
  await db.insert(journalists).values(
    SEED_JOURNALISTS.map((j) => ({
      id: newId(),
      name: j.name,
      outlet: j.outlet,
      avatarColor: avatarColorFor(j.name),
      isSeeded: true,
      createdAt: now,
    })),
  );
  await db.insert(appMeta).values({ key: SEED_FLAG, value: new Date(now).toISOString() });
}

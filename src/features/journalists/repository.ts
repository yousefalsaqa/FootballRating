import { and, asc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { journalists, type Journalist } from '@/db/schema';
import { avatarColorFor } from '@/lib/constants';
import { newId } from '@/lib/id';

/** All journalist persistence lives here — no queries elsewhere. */

export async function listJournalists(options?: {
  includeArchived?: boolean;
}): Promise<Journalist[]> {
  const where = options?.includeArchived ? undefined : isNull(journalists.archivedAt);
  return db.select().from(journalists).where(where).orderBy(asc(journalists.name));
}

export async function getJournalist(id: string): Promise<Journalist | undefined> {
  const rows = await db.select().from(journalists).where(eq(journalists.id, id)).limit(1);
  return rows[0];
}

export async function createJournalist(input: {
  name: string;
  outlet?: string;
}): Promise<Journalist> {
  const row: Journalist = {
    id: newId(),
    name: input.name.trim(),
    outlet: input.outlet?.trim() || null,
    avatarColor: avatarColorFor(input.name.trim()),
    isSeeded: false,
    createdAt: Date.now(),
    archivedAt: null,
  };
  await db.insert(journalists).values(row);
  return row;
}

export async function updateJournalist(
  id: string,
  patch: Partial<Pick<Journalist, 'name' | 'outlet'>>,
): Promise<void> {
  await db.update(journalists).set(patch).where(eq(journalists.id, id));
}

export async function setJournalistArchived(id: string, archived: boolean): Promise<void> {
  await db
    .update(journalists)
    .set({ archivedAt: archived ? Date.now() : null })
    .where(eq(journalists.id, id));
}

/** Hard delete — cascades to the journalist's claims. */
export async function deleteJournalist(id: string): Promise<void> {
  await db.delete(journalists).where(eq(journalists.id, id));
}

export async function findJournalistByName(name: string): Promise<Journalist | undefined> {
  const rows = await db
    .select()
    .from(journalists)
    .where(and(eq(journalists.name, name.trim()), isNull(journalists.archivedAt)))
    .limit(1);
  return rows[0];
}

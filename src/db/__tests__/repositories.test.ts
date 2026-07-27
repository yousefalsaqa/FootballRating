/** @jest-environment node */

/**
 * Repository tests run against a real in-memory SQLite (libsql) database with
 * the actual generated migrations applied — validating schema, CRUD, and
 * cascade behavior exactly as they run on device.
 */

jest.mock('@/db/client', () => {
  const { createClient } = require('@libsql/client');
  const { drizzle } = require('drizzle-orm/libsql');
  const schema = require('@/db/schema');
  const client = createClient({ url: ':memory:' });
  return { db: drizzle(client, { schema }), __client: client };
});

import { migrate } from 'drizzle-orm/libsql/migrator';

import { db } from '@/db/client';
import { seedIfNeeded } from '@/db/seed';
import {
  createClaim,
  deleteClaim,
  deleteDuplicateClaims,
  getClaim,
  getClaimTags,
  listClaims,
  listScoringRows,
  listTags,
  reopenClaim,
  resolveClaim,
  type CreateClaimInput,
} from '@/features/claims/repository';
import {
  createJournalist,
  deleteJournalist,
  findJournalistByName,
  getJournalist,
  listJournalists,
  setJournalistArchived,
  updateJournalist,
} from '@/features/journalists/repository';

function claimInput(journalistId: string, overrides?: Partial<CreateClaimInput>): CreateClaimInput {
  return {
    journalistId,
    headline: 'Wirtz to Liverpool, medical booked',
    playerName: 'Florian Wirtz',
    toClubName: 'Liverpool',
    confidence: 3,
    claimedAt: Date.now(),
    ...overrides,
  };
}

beforeAll(async () => {
  const { __client } = require('@/db/client');
  await __client.execute('PRAGMA foreign_keys = ON');
  await migrate(db as never, { migrationsFolder: 'src/db/migrations' });
});

describe('journalists repository', () => {
  test('create, read, update', async () => {
    const created = await createJournalist({ name: 'Test Reporter', outlet: 'Test FC' });
    expect(created.id).toBeTruthy();
    expect(created.avatarColor).toMatch(/^#/);

    const fetched = await getJournalist(created.id);
    expect(fetched?.name).toBe('Test Reporter');

    await updateJournalist(created.id, { outlet: 'New Outlet' });
    expect((await getJournalist(created.id))?.outlet).toBe('New Outlet');

    expect(await findJournalistByName('Test Reporter')).toBeDefined();
    await deleteJournalist(created.id);
  });

  test('archive hides from default list', async () => {
    const j = await createJournalist({ name: 'Archived Person' });
    await setJournalistArchived(j.id, true);
    const visible = await listJournalists();
    expect(visible.find((row) => row.id === j.id)).toBeUndefined();
    const all = await listJournalists({ includeArchived: true });
    expect(all.find((row) => row.id === j.id)).toBeDefined();
    await deleteJournalist(j.id);
  });

  test('seed is idempotent', async () => {
    await seedIfNeeded();
    const afterFirst = (await listJournalists()).length;
    await seedIfNeeded();
    expect((await listJournalists()).length).toBe(afterFirst);
    expect(await findJournalistByName('Fabrizio Romano')).toBeDefined();
  });
});

describe('claims repository', () => {
  test('create → resolve → reopen lifecycle', async () => {
    const j = await createJournalist({ name: 'Lifecycle Reporter' });
    const claim = await createClaim(claimInput(j.id));
    expect(claim.status).toBe('pending');
    expect(claim.outcome).toBeNull();

    await resolveClaim(claim.id, 'true');
    let fetched = await getClaim(claim.id);
    expect(fetched?.status).toBe('resolved');
    expect(fetched?.outcome).toBe('true');
    expect(fetched?.resolvedAt).toBeGreaterThan(0);

    await reopenClaim(claim.id);
    fetched = await getClaim(claim.id);
    expect(fetched?.status).toBe('pending');
    expect(fetched?.outcome).toBeNull();

    await deleteJournalist(j.id);
  });

  test('filters by status and journalist', async () => {
    const j1 = await createJournalist({ name: 'Filter One' });
    const j2 = await createJournalist({ name: 'Filter Two' });
    const c1 = await createClaim(claimInput(j1.id));
    await createClaim(claimInput(j2.id, { headline: 'Other claim' }));
    await resolveClaim(c1.id, 'false');

    expect(await listClaims({ journalistId: j1.id })).toHaveLength(1);
    const pending = await listClaims({ status: 'pending' });
    expect(pending.every((c) => c.status === 'pending')).toBe(true);
    const resolvedForJ1 = await listClaims({ status: 'resolved', journalistId: j1.id });
    expect(resolvedForJ1).toHaveLength(1);

    await deleteJournalist(j1.id);
    await deleteJournalist(j2.id);
  });

  test('tags are deduped case-insensitively and joined', async () => {
    const j = await createJournalist({ name: 'Tag Reporter' });
    const claim = await createClaim(claimInput(j.id), ['Premier League', 'premier league', 'Done Deal']);
    const claimTagList = await getClaimTags(claim.id);
    expect(claimTagList.map((t) => t.name).sort()).toEqual(['done deal', 'premier league']);

    const allTags = await listTags();
    expect(allTags.filter((t) => t.name === 'premier league')).toHaveLength(1);
    await deleteJournalist(j.id);
  });

  test('deleting a journalist cascades to claims and claim_tags', async () => {
    const j = await createJournalist({ name: 'Cascade Reporter' });
    const claim = await createClaim(claimInput(j.id), ['cascade-tag']);
    await deleteJournalist(j.id);
    expect(await getClaim(claim.id)).toBeUndefined();
    expect(await getClaimTags(claim.id)).toHaveLength(0);
  });

  test('deleting a claim leaves the journalist', async () => {
    const j = await createJournalist({ name: 'Keep Reporter' });
    const claim = await createClaim(claimInput(j.id));
    await deleteClaim(claim.id);
    expect(await getJournalist(j.id)).toBeDefined();
    await deleteJournalist(j.id);
  });

  test('scoring rows only include resolved claims with outcomes', async () => {
    const j = await createJournalist({ name: 'Scoring Reporter' });
    await createClaim(claimInput(j.id, { headline: 'pending one' }));
    const resolved = await createClaim(claimInput(j.id, { headline: 'resolved one', confidence: 2 }));
    await resolveClaim(resolved.id, 'partial');

    const rows = (await listScoringRows()).filter((r) => r.journalistId === j.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: 'partial', confidence: 2 });
    await deleteJournalist(j.id);
  });
});

describe('deleteDuplicateClaims', () => {
  test('collapses same-story filings, preferring the resolved copy', async () => {
    await deleteDuplicateClaims(); // baseline: sweep fixtures from earlier tests

    const j = await createJournalist({ name: 'Dup Reporter' });
    const first = await createClaim(claimInput(j.id, { headline: 'v1', transferWindow: '2026-summer' }));
    const second = await createClaim(claimInput(j.id, { headline: 'v2', transferWindow: '2026-summer' }));
    const third = await createClaim(claimInput(j.id, { headline: 'v3', transferWindow: '2026-summer' }));
    await resolveClaim(second.id, 'true');
    // Same player + destination in a DIFFERENT window is a separate story.
    const otherWindow = await createClaim(claimInput(j.id, { transferWindow: '2027-winter' }));

    const removed = await deleteDuplicateClaims();
    expect(removed).toBe(2);
    expect(await getClaim(second.id)).toBeDefined();
    expect(await getClaim(first.id)).toBeUndefined();
    expect(await getClaim(third.id)).toBeUndefined();
    expect(await getClaim(otherWindow.id)).toBeDefined();
    await deleteJournalist(j.id);
  });
});

describe('ledger snapshot merge', () => {
  test('importSnapshot applies resolutions to same-id pending claims', async () => {
    const { exportSnapshot, importSnapshot } = require('@/features/settings/repository');
    const j = await createJournalist({ name: 'Sync Reporter' });
    const claim = await createClaim(claimInput(j.id, { headline: 'sync me', transferWindow: '2026-summer' }));

    // Another device resolved the same claim (same id) — simulate its snapshot.
    const snapshot = await exportSnapshot(Date.now());
    const remote = {
      ...snapshot,
      claims: snapshot.claims.map((c: { id: string }) =>
        c.id === claim.id
          ? { ...c, status: 'resolved', outcome: 'true', resolvedAt: Date.now() }
          : c,
      ),
    };

    const result = await importSnapshot(remote);
    expect(result.resolutions).toBe(1);
    const updated = await getClaim(claim.id);
    expect(updated?.status).toBe('resolved');
    expect(updated?.outcome).toBe('true');
    await deleteJournalist(j.id);
  });
});

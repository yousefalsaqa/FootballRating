import { z } from 'zod';

import { deleteDuplicateClaims } from '@/features/claims/hooks';
import { ingestUrl } from '@/features/inbox/hooks';
import {
  exportSnapshot,
  exportSnapshotSchema,
  importSnapshot,
  type ImportResult,
} from '@/features/settings/repository';
import { kv } from '@/lib/kv';

/**
 * Cross-device sync: every device merges into ONE ledger snapshot stored by
 * the ingest worker (KV, passcode-protected). Cycle: pull remote → merge into
 * the local DB (importSnapshot + duplicate collapse) → push the merged state
 * back. Union semantics — resolutions win over pending, deletions do not
 * propagate.
 */

export const SYNC_KEY_KV = 'sync.passcode';
const LAST_SYNCED_KV = 'sync.lastSyncedAt';
const LAST_PUSH_HASH_KV = 'sync.lastPushHash';

const pullSchema = z.object({ snapshot: z.unknown().nullable() });

export type SyncOutcome =
  | { status: 'disabled' }
  | { status: 'wrong-key' }
  | { status: 'error' }
  | { status: 'synced'; pulled: ImportResult; pushed: boolean; at: number };

export function lastSyncedAt(): number | null {
  const raw = kv.getItemSync(LAST_SYNCED_KV);
  return raw ? Number(raw) : null;
}

/** djb2 — cheap change detection so idle cycles skip the KV write. */
function hashString(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return String(hash);
}

const NOTHING_PULLED: ImportResult = { journalists: 0, claims: 0, resolutions: 0 };

/**
 * Checks a passcode against the ledger. true = accepted (or the ledger is
 * unclaimed and this passcode would claim it), false = wrong, null = network.
 */
export async function verifyLedgerKey(key: string): Promise<boolean | null> {
  const base = ingestUrl()?.replace(/\/$/, '');
  if (!base) {
    return null;
  }
  try {
    const response = await fetch(`${base}/ledger`, {
      headers: { 'x-ledger-key': key },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401 || response.status === 403) {
      return false;
    }
    return response.ok ? true : null;
  } catch {
    return null;
  }
}

/**
 * One sync cycle. Editors (passcode set) do pull → merge → push; readers
 * (no passcode) just mirror the published ledger — the site is a newspaper.
 */
export async function syncLedger(now: number): Promise<SyncOutcome> {
  const base = ingestUrl()?.replace(/\/$/, '');
  const key = kv.getItemSync(SYNC_KEY_KV);
  if (!base) {
    return { status: 'disabled' };
  }
  const headers: Record<string, string> = key ? { 'x-ledger-key': key } : {};

  let pulled = NOTHING_PULLED;
  try {
    const response = await fetch(`${base}/ledger`, { headers, signal: AbortSignal.timeout(20_000) });
    if (response.status === 401 || response.status === 403) {
      return { status: 'wrong-key' };
    }
    if (!response.ok) {
      return { status: 'error' };
    }
    const { snapshot } = pullSchema.parse(await response.json());
    if (snapshot) {
      const parsed = exportSnapshotSchema.safeParse(snapshot);
      if (parsed.success) {
        pulled = await importSnapshot(parsed.data);
        await deleteDuplicateClaims();
      }
    }
  } catch (error) {
    console.error('Ledger pull failed', error);
    return { status: 'error' };
  }

  // Readers stop here — they never write.
  if (!key) {
    kv.setItemSync(LAST_SYNCED_KV, String(now));
    return { status: 'synced', pulled, pushed: false, at: now };
  }

  // Push the merged state back — skipped when nothing changed since the last
  // push (KV free tier has a daily write budget).
  let pushed = false;
  try {
    const merged = await exportSnapshot(now);
    const canonical = hashString(
      JSON.stringify({
        journalists: merged.journalists,
        claims: merged.claims,
        tags: merged.tags,
        claimTags: merged.claimTags,
      }),
    );
    if (canonical !== kv.getItemSync(LAST_PUSH_HASH_KV)) {
      const response = await fetch(`${base}/ledger`, {
        method: 'PUT',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(merged),
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 401 || response.status === 403) {
        return { status: 'wrong-key' };
      }
      if (!response.ok) {
        return { status: 'error' };
      }
      kv.setItemSync(LAST_PUSH_HASH_KV, canonical);
      pushed = true;
    }
  } catch (error) {
    console.error('Ledger push failed', error);
    return { status: 'error' };
  }

  kv.setItemSync(LAST_SYNCED_KV, String(now));
  return { status: 'synced', pulled, pushed, at: now };
}

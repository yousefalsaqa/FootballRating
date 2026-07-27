import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';

import migrationBundle from '@/db/migrations/migrations';
import * as schema from '@/db/schema';

/**
 * Web replacement for the native expo-sqlite client (Metro picks this file on
 * web). Runs sql.js (SQLite compiled to wasm) in-memory and persists the
 * database bytes to IndexedDB every couple of seconds and on tab hide.
 * Repositories are unchanged — drizzle's query API is identical across drivers.
 */

let realDb: SQLJsDatabase<typeof schema> | null = null;
let rawDb: SqlJsDatabase | null = null;

/** Same import shape as the native client; throws if used before init. */
export const db = new Proxy({} as SQLJsDatabase<typeof schema>, {
  get(_target, prop) {
    if (!realDb) {
      throw new Error('Web database accessed before initialization');
    }
    const value = Reflect.get(realDb as object, prop);
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(realDb) : value;
  },
});

const IDB_NAME = 'journalist-rater-web';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'main';

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbLoad(): Promise<Uint8Array | null> {
  const idb = await idbOpen();
  return new Promise((resolve, reject) => {
    const request = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY);
    request.onsuccess = () => resolve(request.result ? new Uint8Array(request.result) : null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSave(bytes: Uint8Array): Promise<void> {
  const idb = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Applies the bundled drizzle migrations, tracking progress in a meta table. */
function applyMigrations(database: SqlJsDatabase): void {
  database.run(
    'CREATE TABLE IF NOT EXISTS __drizzle_migrations (idx INTEGER PRIMARY KEY, tag TEXT NOT NULL)',
  );
  const applied = new Set<number>();
  const rows = database.exec('SELECT idx FROM __drizzle_migrations');
  for (const value of rows[0]?.values ?? []) {
    applied.add(Number(value[0]));
  }
  const bundle = migrationBundle as {
    journal: { entries: { idx: number; tag: string }[] };
    migrations: Record<string, string>;
  };
  bundle.journal.entries.forEach((entry, index) => {
    if (applied.has(index)) {
      return;
    }
    const sql = bundle.migrations[`m${String(index).padStart(4, '0')}`];
    if (!sql) {
      throw new Error(`Missing bundled migration ${entry.tag}`);
    }
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) {
        database.run(trimmed);
      }
    }
    database.run('INSERT INTO __drizzle_migrations (idx, tag) VALUES (?, ?)', [index, entry.tag]);
  });
}

function wasmPath(): string {
  // public/sql-wasm.wasm — served from the site root (or the Pages base path).
  return window.location.hostname.endsWith('github.io')
    ? '/FootballRating/sql-wasm.wasm'
    : '/sql-wasm.wasm';
}

/** Loads wasm, restores persisted bytes, migrates, and starts the save loop. */
export async function initWebDatabase(): Promise<void> {
  if (realDb) {
    return;
  }
  const SQL = await initSqlJs({ locateFile: wasmPath });
  const saved = await idbLoad().catch(() => null);
  rawDb = saved ? new SQL.Database(saved) : new SQL.Database();
  rawDb.run('PRAGMA foreign_keys = ON');
  applyMigrations(rawDb);
  realDb = drizzle(rawDb, { schema });

  const persist = () => {
    if (rawDb) {
      void idbSave(rawDb.export()).catch((e) => console.error('DB persist failed', e));
    }
  };
  setInterval(persist, 2000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persist();
    }
  });
  window.addEventListener('beforeunload', persist);
}

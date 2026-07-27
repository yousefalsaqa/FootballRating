import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from '@/db/schema';

const sqlite = openDatabaseSync('journalist-rater.db');
sqlite.execSync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

/**
 * The app's single database handle. All access goes through feature
 * repositories — never query `db` from components or hooks directly.
 * Tests replace this module with an in-memory libsql instance.
 */
export const db = drizzle(sqlite, { schema });

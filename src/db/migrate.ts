import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';

/** Native: drizzle's expo-sqlite migrator. Web swaps this file (migrate.web.ts). */
export function useDatabaseReady(): { success: boolean; error: Error | undefined } {
  const { success, error } = useMigrations(db, migrations);
  return { success, error };
}

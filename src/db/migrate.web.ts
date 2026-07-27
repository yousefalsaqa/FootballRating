import { useEffect, useState } from 'react';

import { initWebDatabase } from '@/db/client.web';

/** Web: async sql.js init + bundled migrations, same hook shape as native. */
export function useDatabaseReady(): { success: boolean; error: Error | undefined } {
  const [state, setState] = useState<{ success: boolean; error: Error | undefined }>({
    success: false,
    error: undefined,
  });

  useEffect(() => {
    let cancelled = false;
    initWebDatabase()
      .then(() => {
        if (!cancelled) {
          setState({ success: true, error: undefined });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({ success: false, error: e instanceof Error ? e : new Error(String(e)) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

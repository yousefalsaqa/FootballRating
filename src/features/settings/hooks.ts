import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useSettingsStore } from '@/features/settings/store';
import { syncLedger, type SyncOutcome } from '@/features/settings/sync';

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

function pulledAnything(outcome: SyncOutcome): boolean {
  return (
    outcome.status === 'synced' &&
    outcome.pulled.journalists + outcome.pulled.claims + outcome.pulled.resolutions > 0
  );
}

/**
 * Background cross-device sync: runs a pull→merge→push cycle on launch and
 * every 10 minutes while a ledger passcode is set. Mounted once in the tab
 * layout, next to auto-file/auto-resolve.
 */
export function useLedgerSync(): void {
  const syncKey = useSettingsStore((s) => s.syncKey);
  const queryClient = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (!syncKey) {
      return;
    }
    let cancelled = false;
    const cycle = async () => {
      if (running.current) {
        return;
      }
      running.current = true;
      try {
        const outcome = await syncLedger(Date.now());
        if (!cancelled && pulledAnything(outcome)) {
          void queryClient.invalidateQueries();
        }
      } catch (e: unknown) {
        console.error('Ledger sync failed', e);
      } finally {
        running.current = false;
      }
    };
    void cycle();
    const timer = setInterval(() => void cycle(), SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [syncKey, queryClient]);
}

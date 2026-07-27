import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useSettingsStore } from '@/features/settings/store';
import { syncLedger, type SyncOutcome } from '@/features/settings/sync';
import { syncSignal } from '@/lib/sync-signal';

const SYNC_INTERVAL_MS = 90 * 1000;
const MUTATION_DEBOUNCE_MS = 2_000;

function pulledAnything(outcome: SyncOutcome): boolean {
  return (
    outcome.status === 'synced' &&
    outcome.pulled.journalists + outcome.pulled.claims + outcome.pulled.resolutions > 0
  );
}

/**
 * Editor mode: this device holds the ledger passcode. Editors see the Desk
 * and every filing/resolving control; everyone else reads the published
 * record like a news site.
 */
export function useEditorMode(): boolean {
  return useSettingsStore((s) => s.syncKey !== null);
}

/**
 * Reactive ledger loop: editors run pull→merge→push, readers mirror. Fires
 * on launch, right after any local edit (debounced), whenever the app comes
 * back to the foreground, and on a 90-second idle heartbeat. Mounted once in
 * the tab layout, next to auto-file/auto-resolve.
 */
export function useLedgerSync(): void {
  const syncKey = useSettingsStore((s) => s.syncKey);
  const queryClient = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
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
    // Edits push immediately (debounced so a burst becomes one push).
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = syncSignal.subscribe(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void cycle(), MUTATION_DEBOUNCE_MS);
    });
    // Waking the tab/app pulls right away — no stale ledger after sleep.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void cycle();
      }
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(debounce);
      unsubscribe();
      appState.remove();
    };
  }, [syncKey, queryClient]);
}

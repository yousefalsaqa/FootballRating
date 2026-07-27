import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const CHECK_INTERVAL_MS = 4 * 60 * 1000;

/**
 * Web-only staleness check: the deploy script stamps `version.json`, and a
 * running tab compares it against the stamp it launched with. GitHub Pages
 * caching kept phones on old bundles for a long time — a stale bundle can't
 * understand new ledger fields, so we surface a reload prompt instead of
 * quietly misbehaving.
 */
export function useNewEditionAvailable(): boolean {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const baseUrl =
      (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
    let baseline: string | null = null;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch(`${baseUrl}/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          return;
        }
        const { v } = (await response.json()) as { v?: string };
        if (typeof v !== 'string') {
          return;
        }
        if (baseline === null) {
          baseline = v;
        } else if (v !== baseline && !cancelled) {
          setStale(true);
        }
      } catch {
        // offline / transient — try again next tick
      }
    };
    void check();
    const timer = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return stale;
}

/** Reloads the web app to pick up the freshly deployed bundle. */
export function reloadEdition(): void {
  if (Platform.OS === 'web') {
    window.location.reload();
  }
}

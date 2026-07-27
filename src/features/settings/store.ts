import { create } from 'zustand';

import { SYNC_KEY_KV } from '@/features/settings/sync';
import { kv } from '@/lib/kv';
import type { ThemePreference } from '@/ui/theme';

const THEME_KEY = 'settings.themePreference';
const AUTO_FILE_KEY = 'settings.autoFileIncoming';
const AUTO_RESOLVE_KEY = 'settings.autoResolve';

interface SettingsState {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  /** Automatically file incoming wire reports into the record (default on). */
  autoFileIncoming: boolean;
  setAutoFileIncoming: (enabled: boolean) => void;
  /** Automatically record outcomes when press coverage is conclusive (default on). */
  autoResolve: boolean;
  setAutoResolve: (enabled: boolean) => void;
  /** Shared-ledger passcode; sync runs only while one is set. */
  syncKey: string | null;
  setSyncKey: (key: string | null) => void;
}

function loadThemePreference(): ThemePreference {
  const stored = kv.getItemSync(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** App settings, persisted synchronously (expo-sqlite kv-store; localStorage on web). */
export const useSettingsStore = create<SettingsState>((set) => ({
  themePreference: loadThemePreference(),
  setThemePreference: (preference) => {
    kv.setItemSync(THEME_KEY, preference);
    set({ themePreference: preference });
  },
  autoFileIncoming: kv.getItemSync(AUTO_FILE_KEY) !== 'off',
  setAutoFileIncoming: (enabled) => {
    kv.setItemSync(AUTO_FILE_KEY, enabled ? 'on' : 'off');
    set({ autoFileIncoming: enabled });
  },
  autoResolve: kv.getItemSync(AUTO_RESOLVE_KEY) !== 'off',
  setAutoResolve: (enabled) => {
    kv.setItemSync(AUTO_RESOLVE_KEY, enabled ? 'on' : 'off');
    set({ autoResolve: enabled });
  },
  syncKey: kv.getItemSync(SYNC_KEY_KV) || null,
  setSyncKey: (key) => {
    if (key) {
      kv.setItemSync(SYNC_KEY_KV, key);
    } else {
      kv.removeItemSync(SYNC_KEY_KV);
    }
    set({ syncKey: key });
  },
}));

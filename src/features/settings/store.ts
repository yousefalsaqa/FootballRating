import { create } from 'zustand';

import { kv } from '@/lib/kv';
import type { ThemePreference } from '@/ui/theme';

const THEME_KEY = 'settings.themePreference';
const AUTO_FILE_KEY = 'settings.autoFileIncoming';

interface SettingsState {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  /** Automatically file incoming wire reports into the record (default on). */
  autoFileIncoming: boolean;
  setAutoFileIncoming: (enabled: boolean) => void;
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
}));

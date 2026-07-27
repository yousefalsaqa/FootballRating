import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

import type { ThemePreference } from '@/ui/theme';

const THEME_KEY = 'settings.themePreference';

interface SettingsState {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

function loadThemePreference(): ThemePreference {
  const stored = Storage.getItemSync(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** App settings, persisted synchronously in expo-sqlite's key-value store. */
export const useSettingsStore = create<SettingsState>((set) => ({
  themePreference: loadThemePreference(),
  setThemePreference: (preference) => {
    Storage.setItemSync(THEME_KEY, preference);
    set({ themePreference: preference });
  },
}));

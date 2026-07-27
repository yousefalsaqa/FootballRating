import { create } from 'zustand';

import { kv } from '@/lib/kv';
import type { ThemePreference } from '@/ui/theme';

const THEME_KEY = 'settings.themePreference';

interface SettingsState {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
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
}));

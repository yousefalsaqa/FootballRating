import Storage from 'expo-sqlite/kv-store';

/** Synchronous key-value prefs. Web swaps this file for localStorage (kv.web.ts). */
export const kv = {
  getItemSync: (key: string): string | null => Storage.getItemSync(key),
  setItemSync: (key: string, value: string): void => Storage.setItemSync(key, value),
};

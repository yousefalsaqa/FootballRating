/** Web: localStorage-backed twin of the native expo-sqlite kv-store shim. */
export const kv = {
  getItemSync: (key: string): string | null => window.localStorage.getItem(key),
  setItemSync: (key: string, value: string): void => window.localStorage.setItem(key, value),
  removeItemSync: (key: string): void => window.localStorage.removeItem(key),
};

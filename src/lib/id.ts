import { randomUUID } from 'expo-crypto';

/** The only ID generator in the app. */
export function newId(): string {
  return randomUUID();
}

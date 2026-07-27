/**
 * Tiny pub/sub connecting data mutations to the ledger sync loop without a
 * circular feature import: claims hooks `request()` a sync after any write,
 * and the sync hook subscribes.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export const syncSignal = {
  /** Ask the ledger loop to run soon (fired after local mutations). */
  request(): void {
    for (const listener of listeners) {
      listener();
    }
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

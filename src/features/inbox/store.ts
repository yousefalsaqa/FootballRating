import { create } from 'zustand';

import { kv } from '@/lib/kv';

const DISMISSED_KEY = 'inbox.dismissed';
const DISMISSED_CAP = 300;

function loadDismissed(): string[] {
  try {
    const raw = kv.getItemSync(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

interface InboxState {
  /** Draft ids already handled locally (accepted, auto-filed, or dismissed). */
  dismissedIds: string[];
  dismiss: (draftId: string) => void;
}

/** Shared across the inbox hooks so auto-file and the UI stay consistent. */
export const useInboxStore = create<InboxState>((set) => ({
  dismissedIds: loadDismissed(),
  dismiss: (draftId) =>
    set((state) => {
      const next = [...state.dismissedIds.filter((id) => id !== draftId), draftId].slice(
        -DISMISSED_CAP,
      );
      kv.setItemSync(DISMISSED_KEY, JSON.stringify(next));
      return { dismissedIds: next };
    }),
}));

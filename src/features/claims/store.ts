import { create } from 'zustand';

import type { Confidence } from '@/db/schema';

/** Draft state for the add-claim wizard, shared across its steps. */
export interface ClaimDraft {
  journalistId: string | null;
  headline: string;
  playerName: string;
  playerApiId: number | null;
  fromClubName: string;
  fromClubApiId: number | null;
  toClubName: string;
  toClubApiId: number | null;
  league: string;
  confidence: Confidence;
  transferWindow: string | null;
  sourceUrl: string;
  notes: string;
  tagNames: string[];
}

const EMPTY_DRAFT: ClaimDraft = {
  journalistId: null,
  headline: '',
  playerName: '',
  playerApiId: null,
  fromClubName: '',
  fromClubApiId: null,
  toClubName: '',
  toClubApiId: null,
  league: '',
  confidence: 2,
  transferWindow: null,
  sourceUrl: '',
  notes: '',
  tagNames: [],
};

interface ClaimDraftState {
  draft: ClaimDraft;
  patchDraft: (patch: Partial<ClaimDraft>) => void;
  resetDraft: () => void;
}

export const useClaimDraftStore = create<ClaimDraftState>((set) => ({
  draft: EMPTY_DRAFT,
  patchDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  resetDraft: () => set({ draft: EMPTY_DRAFT }),
}));

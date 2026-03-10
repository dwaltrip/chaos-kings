import { create } from 'zustand';

import type { BestStartResult } from '@protocol/domains/puzzles/server-messages';
import type { UserPuzzleStats } from '@protocol/domains/puzzles/api-types';

type PuzzleStatus = 'idle' | 'playing' | 'ended';

interface PuzzleState {
  status: PuzzleStatus;

  // Results (populated when ended)
  result: BestStartResult | null;

  // User stats (from REST API)
  userStats: UserPuzzleStats | null;

  actions: {
    setStatus: (status: PuzzleStatus) => void;
    setResult: (result: BestStartResult | null) => void;
    setUserStats: (userStats: UserPuzzleStats | null) => void;
    reset: () => void;
  };
}

const usePuzzleStore = create<PuzzleState>((set) => ({
  status: 'idle',
  result: null,
  userStats: null,

  actions: {
    setStatus: (status) => set({ status }),
    setResult: (result) => set({ result }),
    setUserStats: (userStats) => set({ userStats }),
    reset: () =>
      set({
        status: 'idle',
        result: null,
      }),
  },
}));

// Selectors
const selectStatus = (state: PuzzleState) => state.status;
const selectResult = (state: PuzzleState) => state.result;
const selectUserStats = (state: PuzzleState) => state.userStats;
const selectActions = (state: PuzzleState) => state.actions;
const selectIsPuzzleEnded = (state: PuzzleState): boolean => state.status === 'ended';

export type { PuzzleState };
export { usePuzzleStore };
export {
  selectStatus,
  selectResult,
  selectUserStats,
  selectActions,
  selectIsPuzzleEnded,
};

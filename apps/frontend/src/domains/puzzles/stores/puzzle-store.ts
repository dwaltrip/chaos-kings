import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

import type { BoardState, Coord, Movement } from '@core/types';

import type { BestStartResult } from '@protocol/domains/puzzles/server-messages';
import type { UserPuzzleStats } from '@protocol/domains/puzzles/api-types';

import {
  isTileSelected,
  isTileAdjacentToSelected,
  isTileVisible,
  getNeighborVisibility,
  type NeighborVisibility,
} from '@/domains/games/utils/tile-selection-helpers';

type PuzzleStatus = 'idle' | 'playing' | 'ended';

interface PuzzleState {
  // Core state (from server)
  status: PuzzleStatus;
  board: BoardState | null;
  tick: number;
  moveQueue: Movement[];

  // Computed visibility (updated when board changes)
  visibleSquares: Set<string>;

  // Results (populated when ended)
  result: BestStartResult | null;

  // User stats (from REST API)
  userStats: UserPuzzleStats | null;

  // UI state (local)
  selectedTile: Coord | null;

  // Simple setters only - all business logic lives in actions/
  actions: {
    setStatus: (status: PuzzleStatus) => void;
    setTick: (tick: number) => void;
    setBoard: (board: BoardState | null) => void;
    setMoveQueue: (moveQueue: Movement[]) => void;
    setVisibleSquares: (visibleSquares: Set<string>) => void;
    setResult: (result: BestStartResult | null) => void;
    setUserStats: (userStats: UserPuzzleStats | null) => void;
    setSelectedTile: (coord: Coord | null) => void;
    addQueuedMove: (move: Movement) => void;
    reset: () => void;
  };
}

const usePuzzleStore = create<PuzzleState>((set) => ({
  status: 'idle',
  board: null,
  tick: 0,
  moveQueue: [],
  visibleSquares: new Set<string>(),
  result: null,
  userStats: null,
  selectedTile: null,

  actions: {
    setStatus: (status) => set({ status }),
    setTick: (tick) => set({ tick }),
    setBoard: (board) => set({ board }),
    setMoveQueue: (moveQueue) => set({ moveQueue }),
    setVisibleSquares: (visibleSquares) => set({ visibleSquares }),
    setResult: (result) => set({ result }),
    setUserStats: (userStats) => set({ userStats }),
    setSelectedTile: (coord) => set({ selectedTile: coord }),
    addQueuedMove: (move) => set((state) => ({ moveQueue: [...state.moveQueue, move] })),
    reset: () =>
      set({
        status: 'idle',
        board: null,
        tick: 0,
        moveQueue: [],
        visibleSquares: new Set<string>(),
        result: null,
        selectedTile: null,
      }),
  },
}));

// Selectors
const selectStatus = (state: PuzzleState) => state.status;
const selectBoard = (state: PuzzleState) => state.board;
const selectTick = (state: PuzzleState) => state.tick;
const selectMoveQueue = (state: PuzzleState) => state.moveQueue;
const selectResult = (state: PuzzleState) => state.result;
const selectUserStats = (state: PuzzleState) => state.userStats;
const selectSelectedTile = (state: PuzzleState) => state.selectedTile;
const selectActions = (state: PuzzleState) => state.actions;
const selectVisibleSquares = (state: PuzzleState) => state.visibleSquares;

// Parameterized selectors (for per-tile subscriptions)
// These are thin wrappers around shared helpers
const selectIsTileSelected =
  (coord: Coord) =>
  (state: PuzzleState): boolean =>
    isTileSelected(state.selectedTile, coord);

const selectIsAdjacentToSelected =
  (coord: Coord) =>
  (state: PuzzleState): boolean =>
    isTileAdjacentToSelected(state.selectedTile, coord);

const selectIsPuzzleEnded = (state: PuzzleState): boolean => state.status === 'ended';

const selectIsVisible =
  (coord: Coord) =>
  (state: PuzzleState): boolean =>
    state.status === 'ended' || isTileVisible(state.visibleSquares, coord);

const selectNeighborVisibility = (coord: Coord) =>
  useShallow((state: PuzzleState): NeighborVisibility => {
    if (state.status === 'ended') {
      return { top: true, left: true };
    }
    return getNeighborVisibility(state.visibleSquares, coord);
  });

export type { PuzzleState };
export { usePuzzleStore };
export {
  selectStatus,
  selectBoard,
  selectTick,
  selectMoveQueue,
  selectResult,
  selectUserStats,
  selectSelectedTile,
  selectActions,
  selectVisibleSquares,
  selectIsTileSelected,
  selectIsAdjacentToSelected,
  selectIsPuzzleEnded,
  selectIsVisible,
  selectNeighborVisibility,
};

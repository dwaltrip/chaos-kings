import { create } from 'zustand';

import type { BoardState, Coord, Movement } from '@core/types';

import type { BestStartResult } from '@protocol/domains/puzzles/server-messages';

type PuzzleStatus = 'idle' | 'playing' | 'ended';

interface PuzzleState {
  // Core state (from server)
  status: PuzzleStatus;
  board: BoardState | null;
  tick: number;
  moveQueue: Movement[];

  // Results (populated when ended)
  result: BestStartResult | null;

  // UI state (local)
  selectedTile: Coord | null;

  actions: {
    updateState: (tick: number, board: BoardState, moveQueue: Movement[]) => void;
    setEnded: (result: BestStartResult, finalBoard: BoardState) => void;
    reset: () => void;
    setSelectedTile: (coord: Coord | null) => void;
  };
}

const usePuzzleStore = create<PuzzleState>((set) => ({
  status: 'idle',
  board: null,
  tick: 0,
  moveQueue: [],
  result: null,
  selectedTile: null,

  actions: {
    updateState: (tick, board, moveQueue) =>
      set({
        status: 'playing',
        tick,
        board,
        moveQueue,
      }),

    setEnded: (result, finalBoard) =>
      set({
        status: 'ended',
        result,
        board: finalBoard,
      }),

    reset: () =>
      set({
        status: 'idle',
        board: null,
        tick: 0,
        moveQueue: [],
        result: null,
        selectedTile: null,
      }),

    setSelectedTile: (coord) => set({ selectedTile: coord }),
  },
}));

// Selectors
const selectStatus = (state: PuzzleState) => state.status;
const selectBoard = (state: PuzzleState) => state.board;
const selectTick = (state: PuzzleState) => state.tick;
const selectMoveQueue = (state: PuzzleState) => state.moveQueue;
const selectResult = (state: PuzzleState) => state.result;
const selectSelectedTile = (state: PuzzleState) => state.selectedTile;
const selectActions = (state: PuzzleState) => state.actions;

export { usePuzzleStore };
export {
  selectStatus,
  selectBoard,
  selectTick,
  selectMoveQueue,
  selectResult,
  selectSelectedTile,
  selectActions,
};

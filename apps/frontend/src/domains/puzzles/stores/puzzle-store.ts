import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

import type { BoardState, Coord, Movement } from '@core/types';
import { Board } from '@core/board';
import { serializeCoord } from '@core/utils/coordinate-utils';

import type { BestStartResult } from '@protocol/domains/puzzles/server-messages';

import { getTileStore } from '@/domains/games/stores/tile-store-registry';
import { tileOrchestrator } from '@/domains/games/stores/tile-orchestrator';
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

  // UI state (local)
  selectedTile: Coord | null;

  actions: {
    updateState: (tick: number, board: BoardState, moveQueue: Movement[]) => void;
    setEnded: (result: BestStartResult, finalBoard: BoardState) => void;
    reset: () => void;
    setSelectedTile: (coord: Coord | null) => void;
    addQueuedMove: (move: Movement) => void;
  };
}

const usePuzzleStore = create<PuzzleState>((set) => ({
  status: 'idle',
  board: null,
  tick: 0,
  moveQueue: [],
  visibleSquares: new Set<string>(),
  result: null,
  selectedTile: null,

  actions: {
    updateState: (tick, board, moveQueue) => {
      // Update tile stores for per-tile subscriptions
      tileOrchestrator.updateTileSquares(board);

      // Sync queued directions to tile stores (clear all, then re-populate from server)
      tileOrchestrator.clearAllQueuedDirections(board);
      for (const move of moveQueue) {
        const store = getTileStore(move.sourceCoord);
        store.getState().addQueuedDirection(move.direction);
      }

      // Compute visibility (player 0 is the puzzle player)
      const visibleSquares = Board.getVisibleSquares(board, 0);

      set({
        status: 'playing',
        tick,
        board,
        moveQueue,
        visibleSquares,
      });
    },

    setEnded: (result, finalBoard) => {
      tileOrchestrator.updateTileSquares(finalBoard);
      tileOrchestrator.clearAllQueuedDirections(finalBoard);

      // When ended, all squares are visible
      const allVisible = new Set<string>();
      Board.forEachCoord(finalBoard, (c) => allVisible.add(serializeCoord(c)));

      set({
        status: 'ended',
        result,
        board: finalBoard,
        visibleSquares: allVisible,
      });
    },

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

    setSelectedTile: (coord) => set({ selectedTile: coord }),

    addQueuedMove: (move) => set((state) => ({ moveQueue: [...state.moveQueue, move] })),
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

// Helper to get actions outside of React components
const puzzleActions = () => usePuzzleStore.getState().actions;

export type { PuzzleState };
export { usePuzzleStore, puzzleActions };
export {
  selectStatus,
  selectBoard,
  selectTick,
  selectMoveQueue,
  selectResult,
  selectSelectedTile,
  selectActions,
  selectVisibleSquares,
  selectIsTileSelected,
  selectIsAdjacentToSelected,
  selectIsPuzzleEnded,
  selectIsVisible,
  selectNeighborVisibility,
};

import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

import type { BoardState, Coord, Movement } from '@core/types';

import {
  isTileSelected,
  isTileAdjacentToSelected,
  isTileVisible,
  getNeighborVisibility,
  type NeighborVisibility,
} from '@/domains/games/utils/tile-selection-helpers';

interface BoardSessionState {
  board: BoardState | null;
  tick: number;
  selectedTile: Coord | null;
  visibleSquares: Set<string>;
  queuedMoves: Movement[];
  lastExecutedMove: Movement | null;
  isEnded: boolean;

  actions: {
    setBoard: (board: BoardState | null) => void;
    setTick: (tick: number) => void;
    setSelectedTile: (coord: Coord | null) => void;
    clearSelectedTile: () => void;
    setVisibleSquares: (squares: Set<string>) => void;
    setQueuedMoves: (moves: Movement[]) => void;
    addQueuedMove: (move: Movement) => void;
    setLastExecutedMove: (move: Movement | null) => void;
    setIsEnded: (ended: boolean) => void;
    reset: () => void;
  };
}

const useBoardSessionStore = create<BoardSessionState>((set) => ({
  board: null,
  tick: 0,
  selectedTile: null,
  visibleSquares: new Set<string>(),
  queuedMoves: [],
  lastExecutedMove: null,
  isEnded: false,

  actions: {
    setBoard: (board) => set({ board }),
    setTick: (tick) => set({ tick }),
    setSelectedTile: (coord) => set({ selectedTile: coord }),
    clearSelectedTile: () => set({ selectedTile: null }),
    setVisibleSquares: (visibleSquares) => set({ visibleSquares }),
    setQueuedMoves: (queuedMoves) => set({ queuedMoves }),
    addQueuedMove: (move) =>
      set((state) => ({ queuedMoves: [...state.queuedMoves, move] })),
    setLastExecutedMove: (lastExecutedMove) => set({ lastExecutedMove }),
    setIsEnded: (isEnded) => set({ isEnded }),
    reset: () =>
      set({
        board: null,
        tick: 0,
        selectedTile: null,
        visibleSquares: new Set<string>(),
        queuedMoves: [],
        lastExecutedMove: null,
        isEnded: false,
      }),
  },
}));

// Selectors
const selectBoard = (state: BoardSessionState) => state.board;
const selectTick = (state: BoardSessionState) => state.tick;
const selectSelectedTile = (state: BoardSessionState) => state.selectedTile;
const selectQueuedMoves = (state: BoardSessionState) => state.queuedMoves;
const selectIsEnded = (state: BoardSessionState) => state.isEnded;
const selectVisibleSquares = (state: BoardSessionState) => state.visibleSquares;
const selectActions = (state: BoardSessionState) => state.actions;

// Parameterized selectors (for per-tile subscriptions)
const selectIsTileSelected =
  (coord: Coord) =>
  (state: BoardSessionState): boolean =>
    isTileSelected(state.selectedTile, coord);

const selectIsAdjacentToSelected =
  (coord: Coord) =>
  (state: BoardSessionState): boolean =>
    isTileAdjacentToSelected(state.selectedTile, coord);

const selectIsVisible =
  (coord: Coord) =>
  (state: BoardSessionState): boolean =>
    state.isEnded || isTileVisible(state.visibleSquares, coord);

const selectNeighborVisibility = (coord: Coord) =>
  useShallow((state: BoardSessionState): NeighborVisibility => {
    if (state.isEnded) {
      return { top: true, left: true };
    }
    return getNeighborVisibility(state.visibleSquares, coord);
  });

// Move history cache: tick → move executed at that tick (null = no move).
// Not in the Zustand store because it doesn't drive renders — it's consumed
// by actions (e.g. optimistic step-forward) which write computed results
// to the store. Used by sandbox and future replay-edit mode.
const moveHistoryCache = new Map<number, Movement | null>();

// Helper for accessing actions
const boardSessionActions = () => useBoardSessionStore.getState().actions;

export type { BoardSessionState };
export { useBoardSessionStore, boardSessionActions, moveHistoryCache };
export {
  selectBoard,
  selectTick,
  selectSelectedTile,
  selectQueuedMoves,
  selectIsEnded,
  selectVisibleSquares,
  selectActions,
  selectIsTileSelected,
  selectIsAdjacentToSelected,
  selectIsVisible,
  selectNeighborVisibility,
};

import { create } from 'zustand';
import type { Coord, Movement, Square } from '@core/types';
import { blankSquare, isGeneralSquare, isMountainSquare } from '@core/square';

// ------------------------------------------------------
// TODO: Create a helper that forces all pieces of state
// in this file to be `useShallow` compatible
// E.g. not deeply nested.
// Could be a TS utility type
// ------------------------------------------------------

// Phase 1: Only primitive state (no objects requiring useShallow)
interface TileStoreState {
  square: Square;
  isSelected: boolean;
  queuedMoves: Set<Movement>; // Already useShallow compatible

  // Helpers
  getIsGeneral: () => boolean;
  getIsMountain: () => boolean;

  // Actions
  updateSquare: (square: Square) => void;
  updateQueuedMoves: (moves: Set<Movement>) => void;
}

function createTileStore(coord: Coord) {
  return create<TileStoreState>((set, get) => ({
    square: blankSquare(coord),
    isSelected: false,
    queuedMoves: new Set(),

    getIsGeneral: () => isGeneralSquare(get().square),
    getIsMountain: () => isMountainSquare(get().square),

    updateSquare: (square) => set({ square }),
    updateQueuedMoves: (moves) => set({ queuedMoves: moves }),
  }));
}

// Global registry
const tileStoreRegistry = new Map<string, ReturnType<typeof createTileStore>>();

export const getTileStore = (coord: Coord) => {
  const key = `${coord.x},${coord.y}`;
  if (!tileStoreRegistry.has(key)) {
    tileStoreRegistry.set(key, createTileStore(coord));
  }
  return tileStoreRegistry.get(key)!;
};

export type { TileStoreState };

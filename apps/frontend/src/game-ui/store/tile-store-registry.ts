import { create } from 'zustand';

import type { Coord, Direction, Square } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';
import { blankSquare, isGeneralSquare, isMountainSquare } from '@core/square';

// ------------------------------------------------------
// TODO: Create a helper that forces all pieces of state
// in this file to be `useShallow` compatible
// E.g. not deeply nested.
// Could be a TS utility type
// ------------------------------------------------------

interface TileStoreState {
  square: Square;
  isSelected: boolean;
  queuedDirections: Set<Direction>;

  // Helpers
  getIsGeneral: () => boolean;
  getIsMountain: () => boolean;

  // Actions
  updateSquare: (square: Square) => void;
  updateQueuedDirections: (directions: Set<Direction>) => void;
  addQueuedDirection: (direction: Direction) => void;
}

function createTileStore(pos: Coord) {
  return create<TileStoreState>((set, get) => ({
    square: blankSquare(pos),
    isSelected: false,
    queuedDirections: new Set(),

    getIsGeneral: () => isGeneralSquare(get().square),
    getIsMountain: () => isMountainSquare(get().square),

    updateSquare: (square) => set({ square }),
    updateQueuedDirections: (queuedDirections) => set({ queuedDirections }),
    addQueuedDirection: (direction) => {
      set((state) => {
        const queuedDirections = new Set(state.queuedDirections);
        queuedDirections.add(direction);
        return { queuedDirections };
      });
    },
  }));
}

// Global registry
const tileStoreRegistry = new Map<string, ReturnType<typeof createTileStore>>();

const getTileStore = (pos: Coord) => {
  const key = serializeCoord(pos);
  if (!tileStoreRegistry.has(key)) {
    tileStoreRegistry.set(key, createTileStore(pos));
  }
  return tileStoreRegistry.get(key)!;
};

const cleanupTileStore = (pos: Coord) => {
  const key = serializeCoord(pos);
  tileStoreRegistry.delete(key);
};

export { getTileStore, cleanupTileStore };
export type { TileStoreState };

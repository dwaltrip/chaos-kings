import { create } from 'zustand';

import type { Coord, Direction, Square } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';
import { blankSquare } from '@core/square';

interface TileStoreState {
  square: Square;
  queuedDirections: Set<Direction>;

  // Actions
  updateSquare: (square: Square) => void;
  updateQueuedDirections: (directions: Set<Direction>) => void;
  addQueuedDirection: (direction: Direction) => void;
}

function createTileStore(pos: Coord) {
  return create<TileStoreState>((set) => ({
    square: blankSquare(pos),
    queuedDirections: new Set(),

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

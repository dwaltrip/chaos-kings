import { create } from 'zustand';
import type { Coord, Movement } from '@core/types';

// Phase 1: Only primitive state (no objects requiring useShallow)
interface TileStoreState {
  // Simple primitives - safe for normal subscriptions
  isSelected: boolean;
  isGeneral: boolean;
  queuedMoves: Set<Movement>; // Already useShallow compatible

  // Actions
  updateSelection: (selected: boolean) => void;
  updateGeneral: (general: boolean) => void;
  updateQueuedMoves: (moves: Set<Movement>) => void;
}

const createTileStore = () =>
  create<TileStoreState>((set) => ({
    isSelected: false,
    isGeneral: false,
    queuedMoves: new Set(),

    updateSelection: (selected) => set({ isSelected: selected }),
    updateGeneral: (general) => set({ isGeneral: general }),
    updateQueuedMoves: (moves) => set({ queuedMoves: moves }),
  }));

// Global registry
const tileStoreRegistry = new Map<string, ReturnType<typeof createTileStore>>();

export const getTileStore = (coord: Coord) => {
  const key = `${coord.x},${coord.y}`;
  if (!tileStoreRegistry.has(key)) {
    tileStoreRegistry.set(key, createTileStore());
  }
  return tileStoreRegistry.get(key)!;
};

export type { TileStoreState };

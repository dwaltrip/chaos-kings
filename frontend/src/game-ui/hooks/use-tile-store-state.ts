import { useShallow } from 'zustand/shallow';
import type { Coord, Movement } from '@core/types';
import { getTileStore } from '@/game-ui/store/tile-store-registry';

// Phase 1: Individual hooks for each piece of state
export function useTileSelection(coord: Coord): boolean {
  const store = getTileStore(coord);
  return store((state) => state.isSelected);
}

export function useTileGeneral(coord: Coord): boolean {
  const store = getTileStore(coord);
  return store((state) => state.isGeneral);
}

export function useTileQueuedMovesV2(coord: Coord): Set<Movement> {
  const store = getTileStore(coord);
  return store(useShallow((state) => state.queuedMoves));
}

// Optional: Convenience hook if you need multiple values
// (Only use when you actually need ALL of them to avoid unnecessary subscriptions)
export function useTileStoreMultiple(coord: Coord) {
  const store = getTileStore(coord);

  return store(
    useShallow((state) => ({
      isSelected: state.isSelected,
      isGeneral: state.isGeneral,
      queuedMoves: state.queuedMoves,
    })),
  );
}

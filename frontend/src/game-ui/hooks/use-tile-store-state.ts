import { useShallow } from 'zustand/shallow';
import type { Coord, Direction, Square } from '@core/types';
import { getTileStore } from '@/game-ui/store/tile-store-registry';

function useTileSquare(coord: Coord): Square {
  const store = getTileStore(coord);

  // ------------------------------------------------------------------------
  // TODO: I'm sure there's a better way to structure things to avoid this...
  // ------------------------------------------------------------------------
  // Coord is a nested object, which breaks shallow comparison
  // So we extract coord out of square to avoid unnecessary re-renders
  const squareWithoutCoord = store(
    useShallow((state) => {
      const { coord, ...rest } = state.square;
      return rest;
    }),
  );
  return { ...squareWithoutCoord, coord };
}

function useTileQueuedMovesV2(coord: Coord): Set<Direction> {
  const store = getTileStore(coord);
  return store(useShallow((state) => state.queuedMoves));
}

function useTileSquareTypes(coord: Coord) {
  const store = getTileStore(coord);
  return store(
    useShallow((state) => ({
      isMountain: state.getIsMountain(),
      isGeneral: state.getIsGeneral(),
    })),
  );
}

export { useTileSquare, useTileQueuedMovesV2, useTileSquareTypes };

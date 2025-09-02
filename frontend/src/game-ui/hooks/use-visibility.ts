import type { Coord } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';
import { getNeighborCoords } from '@/game-ui/utils/tile-utils';
import { type GameplayStateV2 } from '@/game-ui/store/gameplay-store-v2';
import { useShallow } from 'zustand/shallow';

interface NeighborVisibility {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

const useNeighborVisibility = (coord: Coord) =>
  useShallow((state: GameplayStateV2) => {
    return state.isGameEnded
      ? {
          top: true,
          bottom: true,
          left: true,
          right: true,
        }
      : computeNeighborVisibility(coord, state.visibleSquares);
  });

const useIsVisible = (coord: Coord) =>
  useShallow((state: GameplayStateV2) => {
    return (
      state.isGameEnded ||
      isSquareVisible(coord, state.visibleSquares, state.currentPlayerIndex)
    );
  });

// --- helpers ---

function computeNeighborVisibility(
  coord: Coord,
  visibleSquares: Set<string>,
): NeighborVisibility {
  const neighbors = getNeighborCoords(coord);

  return {
    top: visibleSquares.has(serializeCoord(neighbors.top)),
    bottom: visibleSquares.has(serializeCoord(neighbors.bottom)),
    left: visibleSquares.has(serializeCoord(neighbors.left)),
    right: visibleSquares.has(serializeCoord(neighbors.right)),
  };
}

function isSquareVisible(
  coord: Coord,
  visibleSquares: Set<string>,
  currentPlayerIndex: number | null,
): boolean {
  if (currentPlayerIndex === null) return true;
  return visibleSquares.has(serializeCoord(coord));
}

export { useNeighborVisibility, useIsVisible, type NeighborVisibility };

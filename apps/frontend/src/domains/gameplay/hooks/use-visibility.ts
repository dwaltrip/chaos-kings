import { useShallow } from 'zustand/shallow';

import type { Coord } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import { isTileVisible } from '@/domains/games/utils/tile-selection-helpers';
import { getNeighborCoords } from '@/domains/gameplay/utils/tile-utils';
import { type GameplayStateV2 } from '@/domains/gameplay/stores/gameplay-store-v2';

// Gameplay needs all 4 directions for full neighbor visibility
interface NeighborVisibility {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

const useNeighborVisibility = (coord: Coord) =>
  useShallow((state: GameplayStateV2): NeighborVisibility => {
    return state.isGameEnded()
      ? { top: true, bottom: true, left: true, right: true }
      : computeNeighborVisibility(coord, state.visibleSquares);
  });

const useIsVisible = (coord: Coord) =>
  useShallow((state: GameplayStateV2) => {
    // Spectators (no player index) see everything
    if (state.currentPlayerIndex === null) return true;
    return state.isGameEnded() || isTileVisible(state.visibleSquares, coord);
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

export { useNeighborVisibility, useIsVisible, type NeighborVisibility };

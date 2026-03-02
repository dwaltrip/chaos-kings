import type { Coord } from '@core/types';
import { isAdjacentTo } from '@core/utils/coordinate-utils';

interface NeighborCoords {
  top: Coord;
  bottom: Coord;
  left: Coord;
  right: Coord;
}

interface BorderData {
  top: boolean;
  left: boolean;
}

function getNeighborCoords(coord: Coord): NeighborCoords {
  return {
    top: { x: coord.x, y: coord.y - 1 },
    bottom: { x: coord.x, y: coord.y + 1 },
    left: { x: coord.x - 1, y: coord.y },
    right: { x: coord.x + 1, y: coord.y },
  };
}

export type { NeighborCoords, BorderData };
export { getNeighborCoords, isAdjacentTo };

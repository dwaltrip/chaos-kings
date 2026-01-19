import type { Coord } from '@core/types';
import { areCoordsEqual, serializeCoord } from '@core/utils/coordinate-utils';

import { isAdjacentTo } from '@/domains/gameplay/utils/tile-utils';

function isTileSelected(selectedTile: Coord | null, coord: Coord): boolean {
  return areCoordsEqual(selectedTile, coord);
}

function isTileAdjacentToSelected(selectedTile: Coord | null, coord: Coord): boolean {
  return selectedTile ? isAdjacentTo(selectedTile, coord) : false;
}

function isTileVisible(visibleSquares: Set<string>, coord: Coord): boolean {
  return visibleSquares.has(serializeCoord(coord));
}

interface NeighborVisibility {
  top: boolean;
  left: boolean;
}

function getNeighborVisibility(
  visibleSquares: Set<string>,
  coord: Coord,
): NeighborVisibility {
  return {
    top:
      coord.y > 0 && visibleSquares.has(serializeCoord({ x: coord.x, y: coord.y - 1 })),
    left:
      coord.x > 0 && visibleSquares.has(serializeCoord({ x: coord.x - 1, y: coord.y })),
  };
}

export type { NeighborVisibility };
export { isTileSelected, isTileAdjacentToSelected, isTileVisible, getNeighborVisibility };

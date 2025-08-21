import type { Coord } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

interface NeighborCoords {
  top: Coord;
  bottom: Coord;
  left: Coord;
  right: Coord;
}

interface NeighborVisibility {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

interface BorderData {
  top: boolean;
  left: boolean;
}

interface GridBounds {
  rows: number;
  cols: number;
}

function getNeighborCoords(coord: Coord): NeighborCoords {
  return {
    top: { x: coord.x, y: coord.y - 1 },
    bottom: { x: coord.x, y: coord.y + 1 },
    left: { x: coord.x - 1, y: coord.y },
    right: { x: coord.x + 1, y: coord.y },
  };
}

function isAdjacentTo(coord1: Coord, coord2: Coord): boolean {
  const dx = Math.abs(coord1.x - coord2.x);
  const dy = Math.abs(coord1.y - coord2.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

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

function computeTileBorders(
  coord: Coord,
  neighborVisibility: NeighborVisibility,
  isVisible: boolean,
  // gridBounds: GridBounds,
): BorderData {
  if (!isVisible) {
    return { top: false, left: false };
  }

  const isOnTopEdge = coord.y === 0;
  const isOnLeftEdge = coord.x === 0;

  return {
    top: neighborVisibility.top && !isOnTopEdge,
    left: neighborVisibility.left && !isOnLeftEdge,
  };
}

export type { NeighborCoords, NeighborVisibility, BorderData, GridBounds };
export {
  getNeighborCoords,
  isAdjacentTo,
  computeNeighborVisibility,
  computeTileBorders,
};

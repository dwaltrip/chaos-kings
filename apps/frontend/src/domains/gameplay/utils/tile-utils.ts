// TODO: move this to @core
import type { Coord } from '@core/types';

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

// Check for horizontal and vertical adjacency (no diagonals)
function isAdjacentTo(coord1: Coord, coord2: Coord): boolean {
  const dx = Math.abs(coord1.x - coord2.x);
  const dy = Math.abs(coord1.y - coord2.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

export type { NeighborCoords, BorderData };
export { getNeighborCoords, isAdjacentTo };

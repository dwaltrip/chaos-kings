import type { Coord } from '@core/types';

// Serialize a coordinate to a string key for use in Maps/Sets
function serializeCoord(coord: Coord): string {
  return `${coord.x},${coord.y}`;
}

// Deserialize a string key back to a coordinate object
function deserializeCoord(key: string): Coord {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

function areCoordsEqual(a: Coord | null, b: Coord | null): boolean {
  if (a === null || b === null) {
    return false;
  }
  return a.x === b.x && a.y === b.y;
}

function isAdjacentTo(coord1: Coord, coord2: Coord): boolean {
  const dx = Math.abs(coord1.x - coord2.x);
  const dy = Math.abs(coord1.y - coord2.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

export { serializeCoord, deserializeCoord, areCoordsEqual, isAdjacentTo };

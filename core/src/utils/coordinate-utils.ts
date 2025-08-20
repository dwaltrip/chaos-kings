import type { Coord } from '@core/types';

/**
 * Serialize a coordinate to a string key for use in Maps/Sets
 */
function serializeCoord(coord: Coord): string {
  return `${coord.x},${coord.y}`;
}

/**
 * Deserialize a string key back to a coordinate object
 */
function deserializeCoord(key: string): Coord {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/**
 * Check if two coordinates are equal
 */
function coordsEqual(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export { serializeCoord, deserializeCoord, coordsEqual };

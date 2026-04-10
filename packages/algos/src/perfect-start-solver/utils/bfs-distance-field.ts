import { type FlatBoard } from '@core-next/flat-board';

import { getWalkableNeighbors } from './board-graph';

interface DistanceField {
  // tile index -> distance from start (only reachable tiles are present)
  distance: Map<number, number>;
  // reachable tiles in BFS order (start first, then radiating outward)
  order: number[];
  // start tile (distance 0)
  start: number;
  // max distance observed in the field
  maxDistance: number;
}

interface BfsOptions {
  // If provided, BFS stops expanding past this distance (tiles at exactly
  // maxDepth are included). Omit for no cutoff.
  maxDepth?: number;
}

// BFS from a single source over the walkable graph, returning per-tile
// distances. Cardinal 4-connectivity via getWalkableNeighbors.
function bfsDistanceField(
  board: FlatBoard,
  start: number,
  options: BfsOptions = {},
): DistanceField {
  const maxDepth = options.maxDepth ?? Infinity;
  const distance = new Map<number, number>();
  const order: number[] = [];

  distance.set(start, 0);
  order.push(start);

  // Simple queue; starting regions are small enough that array-based shift
  // would be fine, but we use a head pointer to avoid quadratic cost.
  let head = 0;
  let maxDistance = 0;

  while (head < order.length) {
    const current = order[head++];
    const d = distance.get(current)!;
    if (d >= maxDepth) continue;

    for (const next of getWalkableNeighbors(board, current)) {
      if (distance.has(next)) continue;
      distance.set(next, d + 1);
      order.push(next);
      if (d + 1 > maxDistance) maxDistance = d + 1;
    }
  }

  return { distance, order, start, maxDistance };
}

export type { BfsOptions, DistanceField };
export { bfsDistanceField };

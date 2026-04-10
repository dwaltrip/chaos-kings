import { Board, TileType, type FlatBoard } from '@core-next/flat-board';

import { bfsDistanceField } from '../utils/bfs-distance-field';
import { getWalkableNeighbors, tarjanInSet } from '../utils/board-graph';
import { resolveCrop } from '../utils/crop-board';

import type { StartingRegion, StartingRegionAnnotations } from './types';

// Default radius. MAX_D should cover the longest full burst (prefix +
// suffix), not just the prefix depth, so that analysis near the boundary
// of the region still has context. 13 is a reasonable first-pass value
// given typical B1 burst lengths observed in the burst segmentation data.
const DEFAULT_MAX_DEPTH = 13;

interface BuildOptions {
  maxDepth?: number;
  // Padding (in tiles) around the starting region when computing bbox.
  padding?: number;
}

function buildStartingRegion(
  board: FlatBoard,
  general: number,
  options: BuildOptions = {},
): StartingRegion {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const padding = options.padding ?? 1;

  const field = bfsDistanceField(board, general, { maxDepth });
  const tiles = new Set<number>(field.order);

  const annotations = computeAnnotations(board, field.distance, tiles);

  const bbox = resolveCrop(board, { kind: 'tiles', tiles, padding });

  return {
    general,
    tiles,
    distance: field.distance,
    order: field.order,
    maxDepth,
    bbox,
    annotations,
  };
}

function computeAnnotations(
  board: FlatBoard,
  distance: Map<number, number>,
  tiles: Set<number>,
): StartingRegionAnnotations {
  const outwardDivergence = new Map<number, number>();
  const inwardCount = new Map<number, number>();
  const outwardRayDepth = new Map<number, number>();

  for (const tile of tiles) {
    const d = distance.get(tile)!;
    let outCount = 0;
    let inCount = 0;
    for (const n of getWalkableNeighbors(board, tile)) {
      if (!tiles.has(n)) continue;
      const dn = distance.get(n)!;
      if (dn > d) outCount++;
      else if (dn < d) inCount++;
    }
    outwardDivergence.set(tile, outCount);
    inwardCount.set(tile, inCount);
    outwardRayDepth.set(tile, computeOutwardRayDepth(board, tile));
  }

  const { articulationPoints, bridges } = tarjanInSet(board, tiles);

  return {
    outwardDivergence,
    inwardCount,
    outwardRayDepth,
    articulationPoints,
    bridges,
  };
}

// Max over 4 cardinal directions of the straight-ray depth from the
// given tile until hitting a mountain or the board edge. Depth counts
// the starting tile itself, matching the face-projection convention.
function computeOutwardRayDepth(board: FlatBoard, start: number): number {
  let best = 1;
  const { x, y } = Board.toXY(board, start);
  const dirs: Array<[number, number]> = [
    [0, -1],
    [0, 1],
    [1, 0],
    [-1, 0],
  ];
  for (const [dx, dy] of dirs) {
    let depth = 1;
    let cx = x + dx;
    let cy = y + dy;
    while (cx >= 0 && cy >= 0 && cx < board.width && cy < board.height) {
      const idx = cy * board.width + cx;
      if (board.types[idx] === TileType.MOUNTAIN) break;
      depth++;
      cx += dx;
      cy += dy;
    }
    if (depth > best) best = depth;
  }
  return best;
}

export type { BuildOptions };
export { DEFAULT_MAX_DEPTH, buildStartingRegion };

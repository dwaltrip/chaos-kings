import { Board, TileType, type FlatBoard } from '@core-next/flat-board';

import { bfsDistanceField } from '../utils/bfs-distance-field';
import { getWalkableNeighbors, tarjan, tarjanInSet } from '../utils/board-graph';
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
  const outwardRayDepth = new Map<number, number>();

  for (const tile of tiles) {
    const d = distance.get(tile)!;
    let outCount = 0;
    for (const n of getWalkableNeighbors(board, tile)) {
      if (!tiles.has(n)) continue;
      const dn = distance.get(n)!;
      if (dn > d) outCount++;
    }
    outwardDivergence.set(tile, outCount);
    outwardRayDepth.set(tile, computeOutwardRayDepth(board, tile));
  }

  // Scoped Tarjan picks up both real chokes AND scoping artifacts
  // (e.g. boundary fingers that would loop back with more BFS budget).
  // Full-board Tarjan only flags real structural chokes. Intersecting
  // the two filters out artifacts while preserving real chokes even
  // when they happen to sit near the BFS boundary.
  const scoped = tarjanInSet(board, tiles);
  const full = tarjan(board);

  const articulationPoints = new Set<number>();
  for (const u of scoped.articulationPoints) {
    if (full.articulationPoints.has(u)) articulationPoints.add(u);
  }

  const fullBridgeKeys = new Set<string>();
  for (const [a, b] of full.bridges) {
    fullBridgeKeys.add(bridgeKey(a, b));
  }
  const bridges: Array<[number, number]> = [];
  for (const [a, b] of scoped.bridges) {
    if (fullBridgeKeys.has(bridgeKey(a, b))) bridges.push([a, b]);
  }

  return {
    outwardDivergence,
    outwardRayDepth,
    articulationPoints,
    bridges,
    rawArticulationCount: scoped.articulationPoints.size,
    rawBridgeCount: scoped.bridges.length,
  };
}

function bridgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
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

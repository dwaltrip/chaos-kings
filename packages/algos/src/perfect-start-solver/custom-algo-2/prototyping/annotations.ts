import { Board, TileType, type FlatBoard } from '@core-next/flat-board';

import { getWalkableNeighbors, tarjan, tarjanInSet } from '../../utils/board-graph';

import type { StartingRegion } from '../../starting-region/types';

// Per-tile annotations describing the local topology of the starting
// region. All maps are keyed by tile index; only tiles in the starting
// region are present.
interface CustomAnnotations {
  // Number of walkable neighbors (within the starting region) with d+1.
  // Measures "how many forward directions this tile offers."
  outwardDivergence: Map<number, number>;

  // Max straight-ray depth from this tile over the 4 cardinal directions,
  // stopping at mountains or board edges. Mirrors the face-projection
  // convention (depth includes the starting tile itself). Does NOT stop
  // at the starting region boundary — rays extend as far as walkable
  // geometry allows, so this reflects board openness from this tile.
  outwardRayDepth: Map<number, number>;

  // Articulation points and bridges — filtered to real structural
  // chokes by intersecting the scoped subgraph's Tarjan result with
  // the full board's Tarjan result. A tile is kept iff it's an
  // articulation point on BOTH the induced subgraph AND the full
  // board. Scoping artifacts (e.g. boundary fingers that would loop
  // back with more BFS budget) are filtered out.
  //
  // NOTE: Tried using AP as a tip-scoring signal (penalty for choke
  // tiles) — found NOT useful. Kept here as a general structural
  // annotation since it could be useful for other purposes (e.g.
  // lane-decomp heuristics, path planning).
  articulationPoints: Set<number>;
  bridges: Array<[number, number]>;

  // Raw counts from the scoped Tarjan pass, before full-board
  // filtering. Useful for reporting how many candidate chokes were
  // dropped as scoping artifacts.
  rawArticulationCount: number;
  rawBridgeCount: number;
}

function computeCustomAnnotations(
  region: StartingRegion,
  board: FlatBoard,
): CustomAnnotations {
  const outwardDivergence = new Map<number, number>();
  const outwardRayDepth = new Map<number, number>();

  for (const tile of region.tiles) {
    const d = region.distance.get(tile)!;
    let outCount = 0;
    for (const n of getWalkableNeighbors(board, tile)) {
      if (!region.tiles.has(n)) continue;
      const dn = region.distance.get(n)!;
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
  const scoped = tarjanInSet(board, region.tiles);
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

export type { CustomAnnotations };
export { computeCustomAnnotations };

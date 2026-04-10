import { Board, type FlatBoard } from '@core-next/flat-board';

import { getFrontier } from '../../utils/frontier';

import type { Blob } from './types';

// Crude face-projection feasibility filter for lane decomposition.
//
// For each frontier tile (walkable, non-blob, adjacent to the blob), cast a
// straight ray in each of the 4 cardinal directions. The ray starts at the
// frontier tile itself and advances one tile per step until it hits a
// mountain, the board edge, or a blob tile. Depth = number of tiles in the
// ray (including the frontier tile itself). Rays pointing back into the
// blob immediately terminate at depth 1.
//
// The straight-ray depth under-approximates reachable lane length (lanes
// can turn around obstacles), so this filter produces false negatives but
// no false positives — if face projection says a length is infeasible via
// straight rays, a turning lane might still exist.
//
// The feasibility check is still one-sided: rays from different frontier
// tiles may share tiles, so "k tiles with depth >= L" is a necessary but
// not sufficient condition for k non-overlapping lanes.

type DirIdx = 0 | 1 | 2 | 3; // N, S, E, W

interface FrontierRayDepths {
  frontierTile: number;
  depthByDir: [number, number, number, number]; // [N, S, E, W]
  maxDepth: number;
}

interface FaceProjection {
  frontier: number[];
  rays: FrontierRayDepths[];
}

interface FeasibilityResult {
  feasible: boolean;
  // If feasible, an assignment of (frontier tile, direction) -> lane length,
  // one per requested lane. Purely greedy, not guaranteed optimal.
  assignment?: Array<{
    laneLength: number;
    frontierTile: number;
    dir: DirIdx;
    depth: number;
  }>;
}

function neighborInDir(board: FlatBoard, idx: number, dir: DirIdx): number {
  switch (dir) {
    case 0:
      return Board.neighborUp(board, idx);
    case 1:
      return Board.neighborDown(board, idx);
    case 2:
      return Board.neighborRight(board, idx);
    case 3:
      return Board.neighborLeft(board, idx);
  }
}

// Walk a straight ray from `start` in direction `dir`. Stop at mountain,
// edge, or any tile in `obstacleMask` (the blob). Returns the number of
// tiles in the ray including `start`.
function rayDepth(
  board: FlatBoard,
  start: number,
  dir: DirIdx,
  obstacleMask: bigint,
): number {
  let depth = 1;
  let cur = start;
  while (true) {
    const next = neighborInDir(board, cur, dir);
    if (next < 0) break;
    if (!Board.isPassable(board, next)) break;
    if ((obstacleMask >> BigInt(next)) & 1n) break;
    depth++;
    cur = next;
  }
  return depth;
}

function computeFaceProjection(board: FlatBoard, blob: Blob): FaceProjection {
  const frontier = getFrontier(board, blob.tiles);
  const rays: FrontierRayDepths[] = [];
  for (const f of frontier) {
    const depths: [number, number, number, number] = [
      rayDepth(board, f, 0, blob.mask),
      rayDepth(board, f, 1, blob.mask),
      rayDepth(board, f, 2, blob.mask),
      rayDepth(board, f, 3, blob.mask),
    ];
    const maxDepth = Math.max(depths[0], depths[1], depths[2], depths[3]);
    rays.push({ frontierTile: f, depthByDir: depths, maxDepth });
  }
  return { frontier, rays };
}

// Feasibility check: given target lane lengths, can we assign each a
// distinct frontier tile whose max straight-ray depth is >= the target?
// Greedy: sort lanes descending, sort frontier tiles by maxDepth descending,
// zip and assign. Fails if any lane gets a tile with insufficient depth.
function faceProjectionFeasible(
  projection: FaceProjection,
  laneLengths: number[],
): FeasibilityResult {
  if (laneLengths.length === 0) return { feasible: true, assignment: [] };

  const sortedLanes = [...laneLengths].sort((a, b) => b - a);
  const sortedRays = [...projection.rays].sort((a, b) => b.maxDepth - a.maxDepth);

  if (sortedRays.length < sortedLanes.length) {
    return { feasible: false };
  }

  const assignment: FeasibilityResult['assignment'] = [];
  for (let i = 0; i < sortedLanes.length; i++) {
    const L = sortedLanes[i];
    const ray = sortedRays[i];
    if (ray.maxDepth < L) return { feasible: false };
    // Pick the direction that achieves maxDepth (any — first one wins).
    let dir: DirIdx = 0;
    for (let d = 0 as DirIdx; d < 4; d = (d + 1) as DirIdx) {
      if (ray.depthByDir[d] >= L) {
        dir = d;
        break;
      }
    }
    assignment.push({
      laneLength: L,
      frontierTile: ray.frontierTile,
      dir,
      depth: ray.depthByDir[dir],
    });
  }
  return { feasible: true, assignment };
}

export { computeFaceProjection, faceProjectionFeasible };
export type { FaceProjection, FrontierRayDepths, FeasibilityResult, DirIdx };

import { Board, type FlatBoard } from '@core-next/flat-board';

import { findPath, type PathResult } from '../utils/find-path';

// Lane builder for the prototype solver.
//
// Given a set of (tip, length) requests and an obstacle mask (prefix union +
// general), tries to construct one lane per request via greedy DFS.
//
// The tip is the last tile of the prefix path — it's in the obstacle mask.
// The lane extends beyond the tip into fresh territory: we try each walkable
// neighbor of the tip as a DFS entry point.
//
// Tries all M! orderings of lane construction, since greedy results depend
// on which lane is built first (earlier lanes add to the obstacle mask).

interface LaneRequest {
  tip: number;
  length: number;
}

interface LaneResult {
  // One per request, positionally matched to the input requests (not the
  // internal ordering that succeeded).
  lanes: PathResult[];
}

function buildLanes(
  board: FlatBoard,
  requests: LaneRequest[],
  obstacleMask: bigint,
): LaneResult | null {
  const M = requests.length;
  if (M === 0) return { lanes: [] };

  // Generate all permutations of [0..M-1] to try different orderings.
  const orderings = permutations(M);

  for (const ordering of orderings) {
    const result = tryOrdering(board, requests, obstacleMask, ordering);
    if (result) return result;
  }

  return null;
}

function tryOrdering(
  board: FlatBoard,
  requests: LaneRequest[],
  baseMask: bigint,
  ordering: number[],
): LaneResult | null {
  let mask = baseMask;
  // Store lanes indexed by original request position.
  const lanes: PathResult[] = new Array(ordering.length);

  for (const reqIdx of ordering) {
    const req = requests[reqIdx];
    const lane = buildOneLane(board, req.tip, req.length, mask);
    if (!lane) return null;
    lanes[reqIdx] = lane;
    mask |= lane.mask;
  }

  return { lanes };
}

function buildOneLane(
  board: FlatBoard,
  tip: number,
  length: number,
  obstacleMask: bigint,
): PathResult | null {
  // Try each walkable neighbor of the tip as the lane's starting tile.
  const neighbors = [
    Board.neighborUp(board, tip),
    Board.neighborDown(board, tip),
    Board.neighborLeft(board, tip),
    Board.neighborRight(board, tip),
  ];

  for (const n of neighbors) {
    if (n < 0) continue;
    if (!Board.isPassable(board, n)) continue;
    if ((obstacleMask >> BigInt(n)) & 1n) continue;
    const result = findPath(board, n, length, obstacleMask);
    if (result) return result;
  }

  return null;
}

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  if (n === 1) return [[0]];
  const result: number[][] = [];
  const arr = Array.from({ length: n }, (_, i) => i);

  function permute(start: number): void {
    if (start === n) {
      result.push(arr.slice());
      return;
    }
    for (let i = start; i < n; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  }

  permute(0);
  return result;
}

export type { LaneRequest, LaneResult };
export { buildLanes };

import { Board, type FlatBoard } from '@core-next/flat-board';

// Non-backtracking DFS path finder.
//
// Finds a path of exactly `length` tiles starting at `start`, avoiding
// tiles in `obstacleMask`. The start tile is always the first tile in
// the result. Returns the first path found (DFS order) or null.
//
// Used by both the lane decomposer (greedy-longest-path) and the
// prototype solver's lane builder.

interface PathResult {
  tiles: number[];
  mask: bigint;
}

function findPath(
  board: FlatBoard,
  start: number,
  length: number,
  obstacleMask: bigint,
): PathResult | null {
  if (length < 1) return null;
  if (!Board.isPassable(board, start)) return null;
  if ((obstacleMask >> BigInt(start)) & 1n) return null;

  const path: number[] = new Array(length);
  path[0] = start;
  const startBit = 1n << BigInt(start);
  let found: PathResult | null = null;

  function dfs(depth: number, mask: bigint): boolean {
    if (depth === length) {
      found = { tiles: path.slice(), mask };
      return true;
    }
    const current = path[depth - 1];
    const neighbors = [
      Board.neighborUp(board, current),
      Board.neighborDown(board, current),
      Board.neighborLeft(board, current),
      Board.neighborRight(board, current),
    ];
    for (const n of neighbors) {
      if (n < 0) continue;
      if (!Board.isPassable(board, n)) continue;
      const bit = 1n << BigInt(n);
      if (mask & bit) continue;
      if (obstacleMask & bit) continue;
      path[depth] = n;
      if (dfs(depth + 1, mask | bit)) return true;
    }
    return false;
  }

  dfs(1, startBit);
  return found;
}

export type { PathResult };
export { findPath };

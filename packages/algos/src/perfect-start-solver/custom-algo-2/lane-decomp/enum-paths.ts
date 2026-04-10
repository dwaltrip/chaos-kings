import { Board, type FlatBoard } from '@core-next/flat-board';

import type { Lane } from './types';

// Enumerate all non-backtracking paths of exactly `length` tiles starting
// at `start`, avoiding mountains (via Board.isPassable) and any tiles in
// `obstacleMask`. `start` itself must not be in obstacleMask — the caller
// is expected to pass a frontier tile.
//
// Returns lanes ordered from `start` outward. Each Lane has a bitmask for
// fast downstream overlap checks.
function enumPaths(
  board: FlatBoard,
  start: number,
  length: number,
  obstacleMask: bigint,
): Lane[] {
  if (length < 1) return [];
  if (!Board.isPassable(board, start)) return [];
  if ((obstacleMask >> BigInt(start)) & 1n) return [];

  const results: Lane[] = [];
  const path: number[] = new Array(length);
  path[0] = start;
  const startBit = 1n << BigInt(start);

  function dfs(depth: number, mask: bigint): void {
    if (depth === length) {
      results.push({ tiles: path.slice(), mask });
      return;
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
      if (mask & bit) continue; // already in this path
      if (obstacleMask & bit) continue; // blob / obstacle
      path[depth] = n;
      dfs(depth + 1, mask | bit);
    }
  }

  dfs(1, startBit);
  return results;
}

export { enumPaths };

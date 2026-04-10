import { type FlatBoard } from '@core-next/flat-board';

import { getFrontier } from '../../utils/frontier';

import { enumPaths } from './enum-paths';
import type { Blob, Decomposition, Lane, LaneRequest } from './types';

interface DecomposeOptions {
  board: FlatBoard;
  blob: Blob;
  requests: LaneRequest[];
  maxDecomps: number;
}

interface DecomposeStats {
  frontierSize: number;
  // Total candidate lanes per unique request length.
  candidatesByLength: Map<number, number>;
  elapsedMs: number;
}

interface DecomposeResult {
  decompositions: Decomposition[];
  capped: boolean;
  frontier: number[];
  stats: DecomposeStats;
}

// Exhaustive lane decomposition. For each unique request length, enumerate
// all non-backtracking paths of that length starting from every frontier
// tile. Then recurse through the requests in declared order (caller is
// expected to pass descending-length order so the most constrained lane
// prunes first), keeping only mutually non-overlapping combinations.
//
// Stops after `maxDecomps` valid decompositions. `capped` in the result
// indicates whether the cap was hit (we don't know the true count above it).
function decompose(opts: DecomposeOptions): DecomposeResult {
  const { board, blob, requests, maxDecomps } = opts;
  const startMs = Date.now();

  const frontier = getFrontier(board, blob.tiles);

  // Enumerate candidate lanes per unique length. Candidates from all
  // frontier tiles are pooled into a single list per length.
  const candidatesByLength = new Map<number, Lane[]>();
  const uniqueLengths = new Set(requests.map((r) => r.length));
  for (const len of uniqueLengths) {
    const pool: Lane[] = [];
    for (const entry of frontier) {
      const paths = enumPaths(board, entry, len, blob.mask);
      for (const p of paths) pool.push(p);
    }
    candidatesByLength.set(len, pool);
  }

  const statsCounts = new Map<number, number>();
  for (const [len, pool] of candidatesByLength) {
    statsCounts.set(len, pool.length);
  }

  const decompositions: Decomposition[] = [];
  let capped = false;
  const current: Lane[] = new Array(requests.length);

  function recurse(idx: number, coveredMask: bigint): void {
    if (decompositions.length >= maxDecomps) {
      capped = true;
      return;
    }
    if (idx === requests.length) {
      decompositions.push(current.slice());
      return;
    }
    const pool = candidatesByLength.get(requests[idx].length)!;
    for (const lane of pool) {
      if (lane.mask & coveredMask) continue;
      current[idx] = lane;
      recurse(idx + 1, coveredMask | lane.mask);
      if (decompositions.length >= maxDecomps) return;
    }
  }

  recurse(0, 0n);

  const elapsedMs = Date.now() - startMs;

  return {
    decompositions,
    capped,
    frontier,
    stats: {
      frontierSize: frontier.length,
      candidatesByLength: statsCounts,
      elapsedMs,
    },
  };
}

export { decompose };
export type { DecomposeOptions, DecomposeResult, DecomposeStats };

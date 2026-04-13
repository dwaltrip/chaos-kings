import { type FlatBoard } from '@core-next/flat-board';

import { findPath } from '../../utils/find-path';
import { getFrontier } from '../../utils/frontier';

import type { Blob, Decomposition, Lane } from './types';

// Plain greedy lane decomposer.
//
// Algorithm:
//   1. Sort requested lane lengths descending.
//   2. For each length L in order:
//        - DFS from each frontier tile (in index order), looking for a
//          non-backtracking path of exactly L tiles that avoids the blob
//          and all previously-claimed lane tiles.
//        - First path found wins; its tiles are marked used; proceed.
//      If no path of length L exists, decomposition fails.
//
// No backtracking across lanes: if a lane commits to a path and that
// choice boxes out a later lane, greedy just fails — it does not
// reconsider earlier assignments. This is intentional. The question we're
// answering is "how often does a simple greedy heuristic find a valid
// decomposition when one exists?"
//
// Frontier-tile ordering and DFS neighbor order are deterministic but
// arbitrary. A smarter ordering (e.g. seeded by face projection) is
// deferred.

interface GreedyResult {
  found: boolean;
  lanes?: Decomposition;
  // Index of the lane that failed to find a path (by declared order),
  // or -1 on success. Useful for diagnostics.
  failedAt: number;
  elapsedMs: number;
}

function greedyDecompose(
  board: FlatBoard,
  blob: Blob,
  laneLengths: number[],
): GreedyResult {
  const startMs = Date.now();
  const frontier = getFrontier(board, blob.tiles);

  // Sort lane lengths descending, but remember original index so callers
  // can map results back if needed. (Not currently exposed.)
  const sorted = [...laneLengths].sort((a, b) => b - a);

  let coveredMask = blob.mask;
  const lanes: Lane[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const L = sorted[i];
    let laneFound: Lane | null = null;
    for (const f of frontier) {
      // Skip frontier tiles already consumed by a previous lane.
      if ((coveredMask >> BigInt(f)) & 1n) continue;
      const lane = findPath(board, f, L, coveredMask);
      if (lane !== null) {
        laneFound = lane;
        break;
      }
    }
    if (laneFound === null) {
      return {
        found: false,
        failedAt: i,
        elapsedMs: Date.now() - startMs,
      };
    }
    lanes.push(laneFound);
    coveredMask |= laneFound.mask;
  }

  return {
    found: true,
    lanes,
    failedAt: -1,
    elapsedMs: Date.now() - startMs,
  };
}

export { greedyDecompose };
export type { GreedyResult };

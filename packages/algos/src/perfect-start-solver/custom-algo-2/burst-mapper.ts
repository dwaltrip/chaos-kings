import type { TimingEntry } from '../custom-algo-1/timing-table';

import type { PrefixPath, PrefixSet } from './prefix-gen/generate';

// Maps bursts (from a timing entry) to prefix paths (from a prefix set).
//
// For each burst in departure order, we try assigning it to an unused
// prefix path and verify that the geometric overlap (tiles in the path
// already captured by earlier bursts) matches the timing entry's
// overlaps[i]. We also compute the lane length each burst needs beyond
// its prefix.

interface BurstAssignment {
  burstIndex: number;
  prefixPath: PrefixPath;
  // Geometric overlap: tiles in this prefix path already captured by
  // earlier bursts. Must equal timingEntry.overlaps[burstIndex].
  prefixOverlap: number;
  // 0 = burst contained in prefix, >0 = needs lane extension.
  laneLength: number;
}

function mapBurstsToPaths(
  prefixSet: PrefixSet,
  timingEntry: TimingEntry,
): BurstAssignment[][] {
  const K = timingEntry.captures.length;
  if (K !== prefixSet.prefixes.length) return [];

  const results: BurstAssignment[][] = [];
  const current: BurstAssignment[] = new Array(K);
  const usedPaths = new Array<boolean>(K).fill(false);

  // Cumulative mask of tiles captured by bursts assigned so far.
  // Starts with nothing (general is excluded from prefix paths).
  function recurse(burstIdx: number, capturedMask: bigint): void {
    if (burstIdx === K) {
      results.push(current.slice());
      return;
    }

    const requiredOverlap = timingEntry.overlaps[burstIdx];
    const burstCaptures = timingEntry.captures[burstIdx];

    for (let pi = 0; pi < K; pi++) {
      if (usedPaths[pi]) continue;
      const path = prefixSet.prefixes[pi];

      // Count geometric overlap: tiles in this prefix path that are
      // already in the captured mask.
      let geometricOverlap = 0;
      for (const t of path.tiles) {
        if ((capturedMask >> BigInt(t)) & 1n) {
          geometricOverlap++;
        }
      }

      if (geometricOverlap !== requiredOverlap) continue;

      // Fresh captures from this prefix = prefixLength - geometricOverlap.
      const prefixFreshCaptures = path.tiles.length - geometricOverlap;
      const laneLength = burstCaptures - prefixFreshCaptures;
      if (laneLength < 0) continue;

      current[burstIdx] = {
        burstIndex: burstIdx,
        prefixPath: path,
        prefixOverlap: geometricOverlap,
        laneLength,
      };

      usedPaths[pi] = true;
      // Add this prefix path's tiles to the captured set.
      const newCaptured = capturedMask | path.mask;
      recurse(burstIdx + 1, newCaptured);
      usedPaths[pi] = false;
    }
  }

  recurse(0, 0n);
  return results;
}

export type { BurstAssignment };
export { mapBurstsToPaths };

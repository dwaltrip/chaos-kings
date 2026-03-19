import { tilesToMask } from './bitmask';

type PathsByLen = Map<number, number[][]>;

interface PathEntry {
  tiles: number[];
  mask: bigint;
}

type PathEntriesByLen = Map<number, PathEntry[]>;

// Takes genPathsDP output, strips the start tile (index 0 of each path),
// builds bitmask entries grouped by length.
function buildPathEntries(pathsByLen: PathsByLen): PathEntriesByLen {
  const result: PathEntriesByLen = new Map();

  for (const [len, paths] of pathsByLen.entries()) {
    const entries: PathEntry[] = [];
    for (const path of paths) {
      // strip the general (first element)
      const tiles = path.slice(1);
      if (tiles.length === 0) continue;
      entries.push({ tiles, mask: tilesToMask(tiles) });
    }
    // key by the new length (without the general tile)
    if (entries.length > 0) {
      const newLen = len - 1;
      const existing = result.get(newLen) || [];
      result.set(newLen, existing.concat(entries));
    }
  }

  return result;
}

interface BurstStats {
  tried: number;
  overlapSkips: number;
}

interface SearchStats {
  perBurst: BurstStats[];
}

interface SearchResult {
  paths: PathEntry[];
  coveredMask: bigint;
  stats: SearchStats;
}

// Finds non-overlapping paths for each burst length in the pattern.
// Returns the first valid assignment, or null if none exists.
function findPaths(
  entriesByLen: PathEntriesByLen,
  burstPattern: number[],
): SearchResult | null {
  const stats: SearchStats = {
    perBurst: burstPattern.map(() => ({ tried: 0, overlapSkips: 0 })),
  };

  function search(burstIdx: number, coveredMask: bigint): PathEntry[] | null {
    if (burstIdx === burstPattern.length) {
      return [];
    }

    const burstLen = burstPattern[burstIdx];
    const candidates = entriesByLen.get(burstLen);
    if (!candidates) return null;

    const burstStats = stats.perBurst[burstIdx];

    for (const cand of candidates) {
      if ((cand.mask & coveredMask) !== 0n) {
        burstStats.overlapSkips++;
        continue;
      }

      burstStats.tried++;
      const rest = search(burstIdx + 1, coveredMask | cand.mask);
      if (rest) {
        rest.unshift(cand);
        return rest;
      }
    }

    return null;
  }

  const paths = search(0, 0n);
  if (!paths) return null;

  let coveredMask = 0n;
  for (const p of paths) coveredMask |= p.mask;

  return { paths, coveredMask, stats };
}

export type { PathEntry, PathEntriesByLen };
export { buildPathEntries, findPaths };

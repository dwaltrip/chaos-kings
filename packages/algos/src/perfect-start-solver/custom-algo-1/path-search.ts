import { type GenPath, type GenPathsByLen } from './gen-paths';

interface PathEntry {
  tiles: number[];
  mask: bigint;
}

type PathEntriesByLen = Map<number, PathEntry[]>;

// Takes genPathsDP output, strips the start tile from each path and
// re-keys by the new length. Masks are adjusted to exclude the start tile.
function buildPathEntries(genPaths: GenPathsByLen): PathEntriesByLen {
  const result: PathEntriesByLen = new Map();

  for (const [len, paths] of genPaths.entries()) {
    if (len <= 1) continue;

    const startTile = paths[0]?.tiles[0];
    const startBit = startTile !== undefined ? 1n << BigInt(startTile) : 0n;

    const entries: PathEntry[] = [];
    for (const path of paths) {
      entries.push({
        tiles: path.tiles.slice(1),
        mask: path.mask & ~startBit,
      });
    }

    result.set(len - 1, entries);
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

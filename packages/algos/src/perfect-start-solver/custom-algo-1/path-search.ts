import { type GenPath, type GenPathsByLen } from './gen-paths';
import { simulateOneBurst, type BurstSpec, type TimingState } from './get-burst-info';

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

// Checks whether a path's overlap with owned territory is a clean prefix.
// Returns number of prefix overlap tiles, or -1 if overlap is non-prefix.
function countPrefixOverlap(tiles: number[], coveredMask: bigint): number {
  let prefixLen = 0;

  while (prefixLen < tiles.length) {
    if (!(coveredMask & (1n << BigInt(tiles[prefixLen])))) break;
    prefixLen++;
  }

  for (let i = prefixLen; i < tiles.length; i++) {
    if (coveredMask & (1n << BigInt(tiles[i]))) return -1;
  }

  return prefixLen;
}

interface OverlapConfig {
  maxOverlapPerBurst: number;
  maxTicks: number;
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
  burstSpecs: BurstSpec[];
  coveredMask: bigint;
  stats: SearchStats;
}

type SearchHit = { path: PathEntry; overlap: number };

// Finds paths for each burst in the pattern, with optional overlap support.
// Without overlapConfig: zero-overlap only (original behavior).
// With overlapConfig: tries increasing prefix overlap per burst.
function findPaths(
  entriesByLen: PathEntriesByLen,
  burstPattern: number[],
  overlapConfig?: OverlapConfig,
): SearchResult | null {
  const stats: SearchStats = {
    perBurst: burstPattern.map(() => ({ tried: 0, overlapSkips: 0 })),
  };

  const initialTimingState: TimingState | undefined = overlapConfig
    ? { tick: 1, generalTroops: 1 }
    : undefined;

  function search(
    burstIdx: number,
    coveredMask: bigint,
    timingState?: TimingState,
  ): SearchHit[] | null {
    if (burstIdx === burstPattern.length) return [];

    const captures = burstPattern[burstIdx];
    const maxOverlap =
      overlapConfig && burstIdx > 0 ? overlapConfig.maxOverlapPerBurst : 0;
    const burstStats = stats.perBurst[burstIdx];

    for (let overlap = 0; overlap <= maxOverlap; overlap++) {
      const moves = captures + overlap;

      let nextTimingState: TimingState | undefined;
      if (overlapConfig && timingState) {
        const result = simulateOneBurst(
          captures,
          moves,
          timingState,
          overlapConfig.maxTicks,
        );
        if (!result) break;
        nextTimingState = result.nextState;
      }

      const candidates = entriesByLen.get(moves);
      if (!candidates) continue;

      for (const cand of candidates) {
        // overlapSkips counts both "any overlap" rejections (overlap=0)
        // and "wrong overlap count or non-prefix" rejections (overlap>0)
        // TODO: could count these separately
        if (overlap === 0) {
          if ((cand.mask & coveredMask) !== 0n) {
            burstStats.overlapSkips++;
            continue;
          }
        } else {
          const prefixLen = countPrefixOverlap(cand.tiles, coveredMask);
          if (prefixLen !== overlap) {
            burstStats.overlapSkips++;
            continue;
          }
        }

        burstStats.tried++;
        const newTilesMask = overlap > 0 ? cand.mask & ~coveredMask : cand.mask;
        const rest = search(burstIdx + 1, coveredMask | newTilesMask, nextTimingState);
        if (rest) {
          rest.unshift({ path: cand, overlap });
          return rest;
        }
      }
    }

    return null;
  }

  const hits = search(0, 0n, initialTimingState);
  if (!hits) return null;

  const paths = hits.map((h) => h.path);
  const burstSpecs = hits.map((h, i) => ({
    captures: burstPattern[i],
    moves: burstPattern[i] + h.overlap,
  }));

  let coveredMask = 0n;
  for (const p of paths) coveredMask |= p.mask;

  return { paths, burstSpecs, coveredMask, stats };
}

export type { OverlapConfig, PathEntry, PathEntriesByLen, SearchResult };
export { buildPathEntries, countPrefixOverlap, findPaths };

import { type FlatBoard } from '@/core-next/flat-board';

import { popcount } from './bitmask';
import { genPathsDP } from './gen-paths';
import { getBurstInfosFromSpecs, type BurstInfo, type BurstSpec } from './get-burst-info';
import {
  buildPathEntries,
  countPrefixOverlap,
  type PathEntry,
  type PathEntriesByLen,
} from './path-search';
import {
  buildTimingEntries,
  type TimingEntry,
  type TimingTableConfig,
} from './timing-table';

// ── Types ──

interface Solution {
  pattern: number[];
  burstSpecs: BurstSpec[];
  burstInfos: BurstInfo[];
  paths: PathEntry[];
  coveredMask: bigint;
  totalCaptured: number;
}

interface SolverConfig {
  maxTicks: number;
  maxBurst: number;
  maxBursts: number;
  maxCaptures: number;
  minCaptures: number;
  maxOverlapPerBurst: number;
}

const DEFAULT_CONFIG: SolverConfig = {
  maxTicks: 50,
  maxBurst: 12,
  maxBursts: 6,
  maxCaptures: 24,
  minCaptures: 15,
  maxOverlapPerBurst: 3,
};

interface SolverResult {
  solution: Solution | null;
  entriesChecked: number;
  elapsedMs: number;
}

// ── Timing groups ──

interface TimingGroup {
  burst1Moves: number;
  entries: EntryWithMoves[];
}

interface EntryWithMoves {
  entry: TimingEntry;
  moves: number[];
}

// Group timing entries by burst-1 move length (always = burst-1 captures,
// since burst-1 overlap is always 0). Sorted by burst-1 length descending
// (longest first). Within each group, entries already sorted by total overlap.
function buildTimingGroups(
  totalCaptures: number,
  config: TimingTableConfig,
  entriesByLen: PathEntriesByLen,
): TimingGroup[] {
  const entries = buildTimingEntries(totalCaptures, config);

  const byB1 = new Map<number, EntryWithMoves[]>();
  for (const entry of entries) {
    const moves = entry.captures.map((c, i) => c + entry.overlaps[i]);
    // filter: all required path lengths must exist
    if (!moves.every((m, i) => i === 0 || entriesByLen.has(m))) continue;

    const b1 = entry.captures[0];
    if (!byB1.has(b1)) byB1.set(b1, []);
    byB1.get(b1)!.push({ entry, moves });
  }

  const groups: TimingGroup[] = [];
  for (const [b1, groupEntries] of byB1) {
    groups.push({ burst1Moves: b1, entries: groupEntries });
  }
  groups.sort((a, b) => b.burst1Moves - a.burst1Moves);

  return groups;
}

// ── Grouped backtracking search (burst-2+) ──

// Encode (moveLen, overlap) as a single number for bucketing.
function bucketKey(moveLen: number, overlap: number): number {
  return moveLen * 100 + overlap;
}

interface SearchResult {
  entry: TimingEntry;
  paths: PathEntry[];
}

// Search for compatible paths across a set of timing entries simultaneously.
// At each depth, groups entries by their next burst's (moveLen, overlap),
// scans candidates once per unique combo, then recurses with the sub-bucket.
function searchGrouped(
  entriesByLen: PathEntriesByLen,
  entries: EntryWithMoves[],
  burstIdx: number,
  coveredMask: bigint,
): SearchResult | null {
  // any entry fully assigned at this depth is a solution
  for (const es of entries) {
    if (burstIdx === es.moves.length) {
      return { entry: es.entry, paths: [] };
    }
  }

  // bucket entries by their next burst's (moveLen, overlap)
  const buckets = new Map<number, EntryWithMoves[]>();
  for (const es of entries) {
    const key = bucketKey(es.moves[burstIdx], es.entry.overlaps[burstIdx]);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(es);
  }

  for (const [key, bucket] of buckets) {
    const moveLen = Math.floor(key / 100);
    const overlap = key % 100;
    const candidates = entriesByLen.get(moveLen);
    if (!candidates) continue;

    for (const cand of candidates) {
      if (overlap === 0) {
        if ((cand.mask & coveredMask) !== 0n) continue;
      } else {
        if (popcount(cand.mask & coveredMask) !== overlap) continue;
        if (countPrefixOverlap(cand.tiles, coveredMask) !== overlap) continue;
      }

      const newMask = overlap > 0 ? cand.mask & ~coveredMask : cand.mask;
      const result = searchGrouped(
        entriesByLen,
        bucket,
        burstIdx + 1,
        coveredMask | newMask,
      );
      if (result) {
        result.paths.unshift(cand);
        return result;
      }
    }
  }

  return null;
}

// ── Solver ──

function solveV3(
  board: FlatBoard,
  generalPos: number,
  config: Partial<SolverConfig> = {},
): SolverResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const t0 = performance.now();

  const pathsByLen = genPathsDP(board, generalPos, cfg.maxBurst + 1);
  const entriesByLen = buildPathEntries(pathsByLen);

  const timingConfig: TimingTableConfig = {
    maxTicks: cfg.maxTicks,
    maxBurst: cfg.maxBurst,
    maxBursts: cfg.maxBursts,
    maxOverlapPerBurst: cfg.maxOverlapPerBurst,
  };

  let entriesChecked = 0;

  for (let captures = cfg.maxCaptures; captures >= cfg.minCaptures; captures--) {
    const groups = buildTimingGroups(captures, timingConfig, entriesByLen);

    for (const group of groups) {
      const candidates = entriesByLen.get(group.burst1Moves);
      if (!candidates) continue;
      if (group.entries.length === 0) continue;

      for (const cand of candidates) {
        entriesChecked++;
        const result = searchGrouped(entriesByLen, group.entries, 1, cand.mask);
        if (result) {
          const paths = [cand, ...result.paths];
          const entry = result.entry;
          const moves = entry.captures.map((c, i) => c + entry.overlaps[i]);
          const burstSpecs: BurstSpec[] = entry.captures.map((c, i) => ({
            captures: c,
            moves: moves[i],
          }));

          let solvedMask = 0n;
          for (const p of paths) solvedMask |= p.mask;

          return {
            solution: {
              pattern: entry.captures,
              burstSpecs,
              burstInfos: getBurstInfosFromSpecs(burstSpecs, cfg.maxTicks)!,
              paths,
              coveredMask: solvedMask,
              totalCaptured: popcount(solvedMask),
            },
            entriesChecked,
            elapsedMs: performance.now() - t0,
          };
        }
      }
    }
  }

  return {
    solution: null,
    entriesChecked,
    elapsedMs: performance.now() - t0,
  };
}

export type { Solution, SolverConfig, SolverResult };
export { solveV3 };

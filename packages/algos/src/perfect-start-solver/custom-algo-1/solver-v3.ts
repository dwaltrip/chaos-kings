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
  entries: TimingEntry[];
}

// Group timing entries by burst-1 move length (always = burst-1 captures,
// since burst-1 overlap is always 0). Sorted by burst-1 length descending
// (longest first). Within each group, entries already sorted by total overlap.
function buildTimingGroups(
  totalCaptures: number,
  config: TimingTableConfig,
): TimingGroup[] {
  const entries = buildTimingEntries(totalCaptures, config);

  const byB1 = new Map<number, TimingEntry[]>();
  for (const entry of entries) {
    const b1 = entry.captures[0];
    if (!byB1.has(b1)) byB1.set(b1, []);
    byB1.get(b1)!.push(entry);
  }

  const groups: TimingGroup[] = [];
  for (const [b1, groupEntries] of byB1) {
    groups.push({ burst1Moves: b1, entries: groupEntries });
  }
  groups.sort((a, b) => b.burst1Moves - a.burst1Moves);

  return groups;
}

// ── Forward checking ──

// For a given burst-1 path (coveredMask), check if an entry has at least
// one compatible burst-2 candidate.
function hasViableBurst2(
  entry: TimingEntry,
  coveredMask: bigint,
  entriesByLen: PathEntriesByLen,
): boolean {
  if (entry.captures.length < 2) return true;

  const moveLen = entry.captures[1] + entry.overlaps[1];
  const overlap = entry.overlaps[1];
  const candidates = entriesByLen.get(moveLen);
  if (!candidates) return false;

  for (const cand of candidates) {
    if (overlap === 0) {
      if ((cand.mask & coveredMask) === 0n) return true;
    } else {
      if (popcount(cand.mask & coveredMask) !== overlap) continue;
      if (countPrefixOverlap(cand.tiles, coveredMask) === overlap) return true;
    }
  }

  return false;
}

// ── Backtracking search (burst-2+) ──

// Search for paths for bursts 2..n with a fixed timing entry.
// Same structure as v2's findPathsFixed, starting at burstIdx.
function searchRemaining(
  entriesByLen: PathEntriesByLen,
  entry: TimingEntry,
  moves: number[],
  burstIdx: number,
  coveredMask: bigint,
): PathEntry[] | null {
  if (burstIdx === moves.length) return [];

  const moveLen = moves[burstIdx];
  const overlap = entry.overlaps[burstIdx];
  const candidates = entriesByLen.get(moveLen);
  if (!candidates) return null;

  for (const cand of candidates) {
    if (overlap === 0) {
      if ((cand.mask & coveredMask) !== 0n) continue;
    } else {
      if (popcount(cand.mask & coveredMask) !== overlap) continue;
      if (countPrefixOverlap(cand.tiles, coveredMask) !== overlap) continue;
    }

    const newTiles = overlap > 0 ? cand.mask & ~coveredMask : cand.mask;
    const rest = searchRemaining(
      entriesByLen,
      entry,
      moves,
      burstIdx + 1,
      coveredMask | newTiles,
    );
    if (rest) {
      rest.unshift(cand);
      return rest;
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
    const groups = buildTimingGroups(captures, timingConfig);

    for (const group of groups) {
      const candidates = entriesByLen.get(group.burst1Moves);
      if (!candidates) continue;

      // precompute moves arrays for each entry (avoid recomputing per candidate)
      const entryMoves = group.entries.map((entry) =>
        entry.captures.map((c, i) => c + entry.overlaps[i]),
      );

      // filter entries that have paths at all required lengths
      const viableEntryIndices: number[] = [];
      for (let ei = 0; ei < group.entries.length; ei++) {
        if (entryMoves[ei].every((m, i) => i === 0 || entriesByLen.has(m))) {
          viableEntryIndices.push(ei);
        }
      }
      if (viableEntryIndices.length === 0) continue;

      for (const cand of candidates) {
        const coveredMask = cand.mask;

        for (const ei of viableEntryIndices) {
          const entry = group.entries[ei];
          const moves = entryMoves[ei];

          // forward check: does burst-2 have a compatible candidate?
          if (!hasViableBurst2(entry, coveredMask, entriesByLen)) continue;

          entriesChecked++;
          const rest = searchRemaining(entriesByLen, entry, moves, 1, coveredMask);
          if (rest) {
            const paths = [cand, ...rest];
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
  }

  return {
    solution: null,
    entriesChecked,
    elapsedMs: performance.now() - t0,
  };
}

export type { Solution, SolverConfig, SolverResult };
export { solveV3 };

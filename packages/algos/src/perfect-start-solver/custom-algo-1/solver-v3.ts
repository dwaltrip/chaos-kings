import { Direction } from '@core/types';

import { type FlatBoard, Board, TileType } from '@/core-next/flat-board';

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

interface SearchStats {
  feasibilityChecks: number;
  feasibilityPrunes: number;
  feasibilityEntriesKilled: number;
  candidatesChecked: number;
  searchCalls: number;
}

function emptyStats(): SearchStats {
  return {
    feasibilityChecks: 0,
    feasibilityPrunes: 0,
    feasibilityEntriesKilled: 0,
    candidatesChecked: 0,
    searchCalls: 0,
  };
}

interface SolverResult {
  solution: Solution | null;
  entriesChecked: number;
  elapsedMs: number;
  stats: SearchStats;
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

// ── Flexibility scoring ──
// Score candidates by how much open space they leave near the general.
// Candidates that "trap" the general (cover all nearby tiles) score low;
// candidates that extend outward, leaving room for future bursts, score high.

const FLEX_SCORE_MAX_DIST = 4;
const FEASIBILITY_MAX_DIST = 4;
const DIRECTIONS = [Direction.LEFT, Direction.UP, Direction.RIGHT, Direction.DOWN];

// BFS from general, return mask of tiles at each distance (1..maxDist).
function buildDistanceMasks(
  board: FlatBoard,
  generalPos: number,
  maxDist: number,
): bigint[] {
  const masks: bigint[] = new Array(maxDist + 1).fill(0n);
  const visited = new Set<number>();
  let frontier = [generalPos];
  visited.add(generalPos);

  for (let d = 1; d <= maxDist; d++) {
    const nextFrontier: number[] = [];
    for (const pos of frontier) {
      for (const dir of DIRECTIONS) {
        const next = Board.neighbor(board, pos, dir);
        if (!Board.isValidIndex(board, next)) continue;
        if (board.types[next] === TileType.MOUNTAIN) continue;
        if (visited.has(next)) continue;
        visited.add(next);
        nextFrontier.push(next);
        masks[d] |= 1n << BigInt(next);
      }
    }
    frontier = nextFrontier;
  }

  return masks;
}

// Count free (uncovered) tiles near the general.
// NOTE: currently uses equal weights for all distances. Could try
// distance-based weights (e.g. weights[d] = maxDist - d + 1) to
// prioritize keeping tiles closest to the general free.
function flexScore(candidateMask: bigint, distMasks: bigint[]): number {
  let score = 0;
  for (let d = 1; d < distMasks.length; d++) {
    score += popcount(distMasks[d] & ~candidateMask);
  }
  return score;
}

// Sort each candidate list in entriesByLen by flexibility score (descending).
// Candidates that leave more open space near the general are tried first.
function sortByFlexibility(entriesByLen: PathEntriesByLen, distMasks: bigint[]): void {
  for (const [, candidates] of entriesByLen) {
    const scores = candidates.map((c) => flexScore(c.mask, distMasks));
    const indices = candidates.map((_, i) => i);
    indices.sort((a, b) => scores[b] - scores[a]);
    const sorted = indices.map((i) => candidates[i]);
    for (let i = 0; i < candidates.length; i++) {
      candidates[i] = sorted[i];
    }
  }
}

// ── Feasibility pruning ──
// After choosing a path at some depth, check if the remaining bursts
// for each timing entry are spatially feasible. If every entry has at
// least one burst that can't get enough free tiles within its reach,
// prune this branch.

// Build cumulative blank (uncovered) tile counts by distance from the general.
// blankTilesWithinDist[d] = total uncovered tiles within distances 1..d.
function buildBlankTilesWithinDist(coveredMask: bigint, distMasks: bigint[]): number[] {
  const counts = new Array(distMasks.length).fill(0);
  let running = 0;
  for (let d = 1; d < distMasks.length; d++) {
    running += popcount(distMasks[d] & ~coveredMask);
    counts[d] = running;
  }
  return counts;
}

// Per-burst feasibility: each burst must have enough blank tiles within
// its individual reach.
function entryIsFeasiblePerBurst(
  es: EntryWithMoves,
  burstIdx: number,
  blankByDist: number[],
): boolean {
  const maxDist = blankByDist.length - 1;
  for (let i = burstIdx; i < es.moves.length; i++) {
    const moveLen = es.moves[i];
    const captures = es.entry.captures[i];
    if (moveLen > maxDist) {
      const beyondTiles = moveLen - maxDist;
      if (blankByDist[maxDist] + beyondTiles < captures) return false;
      continue;
    }
    if (blankByDist[moveLen] < captures) return false;
  }
  return true;
}

// Aggregate feasibility: total remaining captures must not exceed total
// blank tiles within the max reach of any remaining burst.
function entryIsFeasibleAggregate(
  es: EntryWithMoves,
  burstIdx: number,
  blankByDist: number[],
): boolean {
  const maxDist = blankByDist.length - 1;
  let totalCaptures = 0;
  let maxMoveLen = 0;
  for (let i = burstIdx; i < es.moves.length; i++) {
    totalCaptures += es.entry.captures[i];
    if (es.moves[i] > maxMoveLen) maxMoveLen = es.moves[i];
  }
  const dist = Math.min(maxMoveLen, maxDist);
  const blankTiles = blankByDist[dist] + Math.max(0, maxMoveLen - maxDist);
  return blankTiles >= totalCaptures;
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
  distMasks: bigint[],
  stats: SearchStats,
): SearchResult | null {
  stats.searchCalls++;

  // any entry fully assigned at this depth is a solution
  for (const es of entries) {
    if (burstIdx === es.moves.length) {
      return { entry: es.entry, paths: [] };
    }
  }

  // early feasibility: before scanning any candidates, check if remaining
  // bursts are spatially possible given current coverage
  stats.feasibilityChecks++;
  const blankByDist = buildBlankTilesWithinDist(coveredMask, distMasks);
  const feasible = entries.filter(
    (es) =>
      entryIsFeasiblePerBurst(es, burstIdx, blankByDist) &&
      entryIsFeasibleAggregate(es, burstIdx, blankByDist),
  );
  stats.feasibilityEntriesKilled += entries.length - feasible.length;
  if (feasible.length === 0) {
    stats.feasibilityPrunes++;
    return null;
  }

  // bucket entries by their next burst's (moveLen, overlap)
  const buckets = new Map<number, EntryWithMoves[]>();
  for (const es of feasible) {
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
      stats.candidatesChecked++;
      if (overlap === 0) {
        if ((cand.mask & coveredMask) !== 0n) continue;
      } else {
        if (popcount(cand.mask & coveredMask) !== overlap) continue;
        if (countPrefixOverlap(cand.tiles, coveredMask) !== overlap) continue;
      }

      const newMask = overlap > 0 ? cand.mask & ~coveredMask : cand.mask;
      const newCovered = coveredMask | newMask;

      // feasibility pruning: check if remaining bursts are possible
      stats.feasibilityChecks++;
      const blankByDist = buildBlankTilesWithinDist(newCovered, distMasks);
      const feasibleEntries = bucket.filter(
        (es) =>
          entryIsFeasiblePerBurst(es, burstIdx + 1, blankByDist) &&
          entryIsFeasibleAggregate(es, burstIdx + 1, blankByDist),
      );
      const killed = bucket.length - feasibleEntries.length;
      stats.feasibilityEntriesKilled += killed;
      if (feasibleEntries.length === 0) {
        stats.feasibilityPrunes++;
        continue;
      }

      const result = searchGrouped(
        entriesByLen,
        feasibleEntries,
        burstIdx + 1,
        newCovered,
        distMasks,
        stats,
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

  const flexDistMasks = buildDistanceMasks(board, generalPos, FLEX_SCORE_MAX_DIST);
  sortByFlexibility(entriesByLen, flexDistMasks);

  const feasDistMasks = buildDistanceMasks(board, generalPos, FEASIBILITY_MAX_DIST);

  const timingConfig: TimingTableConfig = {
    maxTicks: cfg.maxTicks,
    maxBurst: cfg.maxBurst,
    maxBursts: cfg.maxBursts,
    maxOverlapPerBurst: cfg.maxOverlapPerBurst,
  };

  let entriesChecked = 0;
  const stats = emptyStats();

  for (let captures = cfg.maxCaptures; captures >= cfg.minCaptures; captures--) {
    const groups = buildTimingGroups(captures, timingConfig, entriesByLen);

    for (const group of groups) {
      const candidates = entriesByLen.get(group.burst1Moves);
      if (!candidates) continue;
      if (group.entries.length === 0) continue;

      for (const cand of candidates) {
        entriesChecked++;
        const result = searchGrouped(
          entriesByLen,
          group.entries,
          1,
          cand.mask,
          feasDistMasks,
          stats,
        );
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
            stats,
          };
        }
      }
    }
  }

  return {
    solution: null,
    entriesChecked,
    elapsedMs: performance.now() - t0,
    stats,
  };
}

export type { Solution, SolverConfig, SolverResult };
export { solveV3 };

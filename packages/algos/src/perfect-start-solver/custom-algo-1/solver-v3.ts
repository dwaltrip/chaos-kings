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

const FEASIBILITY_MAX_DIST = 4;
const DIRECTIONS = [Direction.LEFT, Direction.UP, Direction.RIGHT, Direction.DOWN];

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

// ── Neighbor partitioning (L1) ──

interface NeighborInfo {
  tile: number;
  bit: bigint;
}

// Candidates grouped by starting neighbor for each move length.
// partitioned.get(moveLen)?.[neighborIdx] → PathEntry[]
type PartitionedEntries = Map<number, PathEntry[][]>;

// Static context shared across all recursive search calls.
interface SearchContext {
  partitioned: PartitionedEntries;
  neighborInfos: NeighborInfo[];
  blankTileMasks: bigint[];
  stats: SearchStats;
}

function getNeighborInfos(board: FlatBoard, generalPos: number): NeighborInfo[] {
  const infos: NeighborInfo[] = [];
  for (const dir of DIRECTIONS) {
    const next = Board.neighbor(board, generalPos, dir);
    if (!Board.isValidIndex(board, next)) continue;
    if (board.types[next] === TileType.MOUNTAIN) continue;
    infos.push({ tile: next, bit: 1n << BigInt(next) });
  }
  return infos;
}

function buildPartitionedEntries(
  entriesByLen: PathEntriesByLen,
  neighborInfos: NeighborInfo[],
): PartitionedEntries {
  const neighborIdx = new Map<number, number>();
  for (let i = 0; i < neighborInfos.length; i++) {
    neighborIdx.set(neighborInfos[i].tile, i);
  }

  const result: PartitionedEntries = new Map();
  for (const [len, entries] of entriesByLen) {
    const byNeighbor: PathEntry[][] = neighborInfos.map(() => []);
    for (const entry of entries) {
      const idx = neighborIdx.get(entry.tiles[0]);
      if (idx === undefined) {
        throw new Error(`tiles[0]=${entry.tiles[0]} is not a neighbor of the general`);
      }
      byNeighbor[idx].push(entry);
    }
    result.set(len, byNeighbor);
  }
  return result;
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

// BFS from general, return cumulative masks of tiles within each distance.
// blankTileMasks[d] = all reachable non-mountain tiles within distances 1..d.
function precomputeBlankTileDistMasks(
  board: FlatBoard,
  generalPos: number,
  maxDist: number,
): bigint[] {
  const blankTileMasks: bigint[] = new Array(maxDist + 1).fill(0n);
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
      }
    }
    blankTileMasks[d] = blankTileMasks[d - 1];
    for (const pos of nextFrontier) {
      blankTileMasks[d] |= 1n << BigInt(pos);
    }
    frontier = nextFrontier;
  }

  return blankTileMasks;
}

// ── Feasibility pruning ──
// After choosing a path at some depth, check if the remaining bursts
// for each timing entry are spatially feasible. If every entry has at
// least one burst that can't get enough free tiles within its reach,
// prune this branch.

// Count blank tiles within a given distance, using cumulative masks.
function blankTilesWithinDist(
  dist: number,
  coveredMask: bigint,
  blankTileMasks: bigint[],
): number {
  const maxDist = blankTileMasks.length - 1;
  if (dist > maxDist) {
    const beyondTiles = dist - maxDist;
    return popcount(blankTileMasks[maxDist] & ~coveredMask) + beyondTiles;
  }
  return popcount(blankTileMasks[dist] & ~coveredMask);
}

// Per-burst feasibility: each burst must have enough blank tiles within
// its individual reach.
function entryIsFeasiblePerBurst(
  es: EntryWithMoves,
  burstIdx: number,
  coveredMask: bigint,
  blankTileMasks: bigint[],
): boolean {
  for (let i = burstIdx; i < es.moves.length; i++) {
    const blank = blankTilesWithinDist(es.moves[i], coveredMask, blankTileMasks);
    if (blank < es.entry.captures[i]) return false;
  }
  return true;
}

// General neighbor bottleneck: every path starts from the general.
// Each burst with overlap=0 must step to a distinct blank neighbor.
// If more zero-overlap bursts remain than blank neighbors, prune.
function entryIsFeasibleNeighbors(
  es: EntryWithMoves,
  burstIdx: number,
  blankNeighborCount: number,
): boolean {
  let zeroOverlapBursts = 0;
  for (let i = burstIdx; i < es.moves.length; i++) {
    if (es.entry.overlaps[i] === 0) zeroOverlapBursts++;
  }
  return zeroOverlapBursts <= blankNeighborCount;
}

// Aggregate feasibility: total remaining captures must not exceed total
// blank tiles within the max reach of any remaining burst.
function entryIsFeasibleAggregate(
  es: EntryWithMoves,
  burstIdx: number,
  coveredMask: bigint,
  blankTileMasks: bigint[],
): boolean {
  let totalCaptures = 0;
  let maxMoveLen = 0;
  for (let i = burstIdx; i < es.moves.length; i++) {
    totalCaptures += es.entry.captures[i];
    if (es.moves[i] > maxMoveLen) maxMoveLen = es.moves[i];
  }
  const blank = blankTilesWithinDist(maxMoveLen, coveredMask, blankTileMasks);
  return blank >= totalCaptures;
}

// NOTE: A stronger "distance-band packing" check was considered that
// subsumes both per-burst and aggregate checks. The idea: sort remaining
// bursts by moveLen ascending, then check cumulative captures at each
// distance threshold. At position j in the sorted order, the j
// shortest-reach bursts are ALL restricted to tiles within
// blankByDist[moveLen_j], so their combined captures must fit.
// This catches cases where multiple short-reach bursts compete for the
// same inner tiles — neither per-burst nor aggregate alone would catch it.
// However, since burst captures are generated in descending order
// (genDescendingPartitions), short-reach bursts tend to have few captures,
// making the intermediate constraints rarely binding. Profiling on all
// test boards showed zero additional prunes, with a ~30% regression from
// the larger EntryWithMoves objects hurting cache locality in the hot loop.
// Reverted in favor of the simpler separate checks.

// ── Grouped backtracking search (burst-2+) ──

// Encode (moveLen, overlap) as a single number for bucketing.
const BucketKey = {
  pack(moveLen: number, overlap: number): number {
    return moveLen * 100 + overlap;
  },
  moveLen(key: number): number {
    return Math.floor(key / 100);
  },
  overlap(key: number): number {
    return key % 100;
  },
};

// Group entries by their next burst's (moveLen, overlap) tuple.
// Entries with the same combo share a candidate scan.
function bucketByMoveLenOverlap(
  entries: EntryWithMoves[],
  burstIdx: number,
): Map<number, EntryWithMoves[]> {
  const buckets = new Map<number, EntryWithMoves[]>();
  for (const es of entries) {
    const key = BucketKey.pack(es.moves[burstIdx], es.entry.overlaps[burstIdx]);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(es);
  }
  return buckets;
}

interface SearchResult {
  entry: TimingEntry;
  paths: PathEntry[];
}

function buildSolution(
  entry: TimingEntry,
  paths: PathEntry[],
  maxTicks: number,
): Solution {
  const moves = entry.captures.map((c, i) => c + entry.overlaps[i]);
  const burstSpecs: BurstSpec[] = entry.captures.map((c, i) => ({
    captures: c,
    moves: moves[i],
  }));
  let coveredMask = 0n;
  for (const p of paths) coveredMask |= p.mask;
  return {
    pattern: entry.captures,
    burstSpecs,
    burstInfos: getBurstInfosFromSpecs(burstSpecs, maxTicks)!,
    paths,
    coveredMask,
    totalCaptured: popcount(coveredMask),
  };
}

// Search for compatible paths across a set of timing entries simultaneously.
// At each depth, groups entries by their next burst's (moveLen, overlap),
// then iterates only relevant neighbor partitions (L1 filtering).
// Scans candidates once per unique (moveLen, overlap) combo per partition,
// then recurses with the sub-bucket.
function searchGrouped(
  ctx: SearchContext,
  entries: EntryWithMoves[],
  burstIdx: number,
  coveredMask: bigint,
): SearchResult | null {
  ctx.stats.searchCalls++;

  // any entry fully assigned at this depth is a solution
  for (const es of entries) {
    if (burstIdx === es.moves.length) {
      return { entry: es.entry, paths: [] };
    }
  }

  // feasibility: check if remaining bursts are spatially possible
  ctx.stats.feasibilityChecks++;
  let blankNeighborCount = 0;
  for (const nb of ctx.neighborInfos) {
    if ((coveredMask & nb.bit) === 0n) blankNeighborCount++;
  }
  const feasible = entries.filter(
    (es) =>
      entryIsFeasibleNeighbors(es, burstIdx, blankNeighborCount) &&
      entryIsFeasiblePerBurst(es, burstIdx, coveredMask, ctx.blankTileMasks) &&
      entryIsFeasibleAggregate(es, burstIdx, coveredMask, ctx.blankTileMasks),
  );
  ctx.stats.feasibilityEntriesKilled += entries.length - feasible.length;
  if (feasible.length === 0) {
    ctx.stats.feasibilityPrunes++;
    return null;
  }

  const buckets = bucketByMoveLenOverlap(feasible, burstIdx);

  for (const [key, bucket] of buckets) {
    const moveLen = BucketKey.moveLen(key);
    const overlap = BucketKey.overlap(key);
    const partitionsAtLen = ctx.partitioned.get(moveLen);
    if (!partitionsAtLen) continue;

    // Iterate only relevant neighbor partitions (L1 filtering).
    // Zero-overlap: tiles[0] must NOT be covered → skip covered neighbors.
    // Overlap > 0: tiles[0] MUST be covered, because prefix overlap requires
    // contiguous coverage starting at tiles[0] (countPrefixOverlap invariant).
    for (let ni = 0; ni < ctx.neighborInfos.length; ni++) {
      const neighborCovered = (coveredMask & ctx.neighborInfos[ni].bit) !== 0n;
      if (overlap === 0 && neighborCovered) continue;
      if (overlap > 0 && !neighborCovered) continue;

      const partition = partitionsAtLen[ni];
      for (const cand of partition) {
        ctx.stats.candidatesChecked++;
        if (overlap === 0) {
          if ((cand.mask & coveredMask) !== 0n) continue;
        } else {
          if (popcount(cand.mask & coveredMask) !== overlap) continue;
          if (countPrefixOverlap(cand.tiles, coveredMask) !== overlap) continue;
        }

        const newMask = overlap > 0 ? cand.mask & ~coveredMask : cand.mask;
        const newCovered = coveredMask | newMask;

        const result = searchGrouped(ctx, bucket, burstIdx + 1, newCovered);
        if (result) {
          result.paths.unshift(cand);
          return result;
        }
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
  const neighborInfos = getNeighborInfos(board, generalPos);
  const partitioned = buildPartitionedEntries(entriesByLen, neighborInfos);
  const blankTileMasks = precomputeBlankTileDistMasks(
    board,
    generalPos,
    FEASIBILITY_MAX_DIST,
  );

  const timingConfig: TimingTableConfig = {
    maxTicks: cfg.maxTicks,
    maxBurst: cfg.maxBurst,
    maxBursts: cfg.maxBursts,
    maxOverlapPerBurst: cfg.maxOverlapPerBurst,
  };

  let entriesChecked = 0;
  const stats = emptyStats();
  const ctx: SearchContext = { partitioned, neighborInfos, blankTileMasks, stats };

  for (let captures = cfg.maxCaptures; captures >= cfg.minCaptures; captures--) {
    const groups = buildTimingGroups(captures, timingConfig, entriesByLen);

    for (const group of groups) {
      // Burst-1 iterates flat candidates — not partitioned. coveredMask is
      // empty here so no neighbor partitions can be skipped (all are free).
      const candidates = entriesByLen.get(group.burst1Moves);
      if (!candidates) continue;
      if (group.entries.length === 0) continue;

      for (const cand of candidates) {
        entriesChecked++;
        const result = searchGrouped(ctx, group.entries, 1, cand.mask);
        if (result) {
          const solution = buildSolution(
            result.entry,
            [cand, ...result.paths],
            cfg.maxTicks,
          );
          return {
            solution,
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

export type {
  EntryWithMoves,
  NeighborInfo,
  PartitionedEntries,
  SearchContext,
  SearchResult,
  SearchStats,
  Solution,
  SolverConfig,
  SolverResult,
  TimingGroup,
};
export {
  bucketByMoveLenOverlap,
  BucketKey,
  buildPartitionedEntries,
  buildSolution,
  buildTimingGroups,
  DEFAULT_CONFIG,
  emptyStats,
  entryIsFeasibleAggregate,
  entryIsFeasibleNeighbors,
  entryIsFeasiblePerBurst,
  FEASIBILITY_MAX_DIST,
  getNeighborInfos,
  precomputeBlankTileDistMasks,
  solveV3,
};

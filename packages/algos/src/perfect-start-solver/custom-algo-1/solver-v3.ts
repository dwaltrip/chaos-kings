import { Direction } from '@core/types';

import { type FlatBoard, Board, TileType } from '@/core-next/flat-board';

import { popcount } from './bitmask';
import { bfsCumulativeMasks } from './board-bfs';
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
  profile: boolean;
}

const DEFAULT_CONFIG: SolverConfig = {
  maxTicks: 50,
  maxBurst: 12,
  maxBursts: 6,
  maxCaptures: 24,
  minCaptures: 15,
  maxOverlapPerBurst: 3,
  profile: false,
};

// Keys: "N_P_A" where N=neighbors, P=perBurst, A=aggregate.
// 1 = passed, 0 = failed. E.g. "1_0_1" = passed neighbors, failed perBurst, passed aggregate.
type FeasProfileKey = `${0 | 1}_${0 | 1}_${0 | 1}`;
type FeasibilityProfile = Record<FeasProfileKey, number>;

function emptyFeasProfile(): FeasibilityProfile {
  return {
    '0_0_0': 0,
    '0_0_1': 0,
    '0_1_0': 0,
    '0_1_1': 0,
    '1_0_0': 0,
    '1_0_1': 0,
    '1_1_0': 0,
    '1_1_1': 0,
  };
}

function feasProfileDelta(
  current: FeasibilityProfile,
  prev: FeasibilityProfile,
): FeasibilityProfile {
  const result = emptyFeasProfile();
  for (const key of Object.keys(result) as FeasProfileKey[]) {
    result[key] = current[key] - prev[key];
  }
  return result;
}

interface SearchStats {
  feasibilityChecks: number;
  feasibilityPrunes: number;
  feasibilityEntriesKilled: number;
  candidatesChecked: number;
  candidatesPassed: number;
  searchCalls: number;
  feasProfile: FeasibilityProfile | null;
}

function emptyStats(profile: boolean): SearchStats {
  return {
    feasibilityChecks: 0,
    feasibilityPrunes: 0,
    feasibilityEntriesKilled: 0,
    candidatesChecked: 0,
    candidatesPassed: 0,
    searchCalls: 0,
    feasProfile: profile ? emptyFeasProfile() : null,
  };
}

interface TargetProfile {
  captures: number;
  timingTableMs: number;
  searchMs: number;
  groupCount: number;
  totalTimingEntries: number;
  burst1Entries: number;
  candidatesChecked: number;
  candidatesPassed: number;
  searchCalls: number;
  feasibilityChecks: number;
  feasibilityPrunes: number;
  feasibilityEntriesKilled: number;
  feasProfile: FeasibilityProfile | null;
}

interface ProfileData {
  pathGenMs: number;
  targets: TargetProfile[];
}

interface SolverResult {
  solution: Solution | null;
  entriesChecked: number;
  elapsedMs: number;
  stats: SearchStats;
  profileData: ProfileData | null;
}

// ── Neighbor partitioning (L1) ──

interface NeighborInfo {
  tile: number;
  bit: bigint;
  // Cumulative BFS masks from this neighbor (excluding general).
  // blankMasks[d] = reachable non-mountain tiles within distance d from this neighbor.
  // Used for L3 per-neighbor feasibility pruning.
  blankMasks: bigint[];
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
  profile: boolean;
}

function getNeighborInfos(
  board: FlatBoard,
  generalPos: number,
  maxBurstLen: number,
): NeighborInfo[] {
  const infos: NeighborInfo[] = [];
  for (const dir of DIRECTIONS) {
    const next = Board.neighbor(board, generalPos, dir);
    if (!Board.isValidIndex(board, next)) continue;
    if (board.types[next] === TileType.MOUNTAIN) continue;
    infos.push({
      tile: next,
      bit: 1n << BigInt(next),
      // Path of moveLen M starts at the neighbor (tiles[0]) and extends M-1
      // more steps. BFS from neighbor excluding general — tiles reachable
      // through this neighbor specifically.
      blankMasks: bfsCumulativeMasks(board, [next], maxBurstLen - 1, [generalPos]),
    });
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
// The general tile itself is excluded from the masks (it's the start, not capturable).
function precomputeBlankTileDistMasks(
  board: FlatBoard,
  generalPos: number,
  maxDist: number,
): bigint[] {
  const raw = bfsCumulativeMasks(board, [generalPos], maxDist);
  const generalBit = 1n << BigInt(generalPos);
  return raw.map((mask) => mask & ~generalBit);
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

  const feasible: EntryWithMoves[] = [];
  const shortCircuit = !ctx.profile;
  for (const es of entries) {
    const n = entryIsFeasibleNeighbors(es, burstIdx, blankNeighborCount);
    if (!n && shortCircuit) {
      continue;
    }
    const p = entryIsFeasiblePerBurst(es, burstIdx, coveredMask, ctx.blankTileMasks);
    if (!p && shortCircuit) {
      continue;
    }
    const a = entryIsFeasibleAggregate(es, burstIdx, coveredMask, ctx.blankTileMasks);

    if (ctx.profile) {
      const key = `${n ? 1 : 0}_${p ? 1 : 0}_${a ? 1 : 0}` as FeasProfileKey;
      ctx.stats.feasProfile![key]++;
    }
    if (n && p && a) {
      feasible.push(es);
    }
  }

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
      const nb = ctx.neighborInfos[ni];
      const neighborCovered = (coveredMask & nb.bit) !== 0n;
      if (overlap === 0 && neighborCovered) continue;
      if (overlap > 0 && !neighborCovered) continue;

      // L3 pruning: for zero-overlap bursts, check if this neighbor's
      // reachable territory has enough blank tiles for the required captures.
      // All entries in a bucket share the same captures at this burstIdx
      // (same moveLen and overlap → same captures).
      //
      // NOTE: This check produced zero additional prunes on all 29 test boards
      // (session 3.21-1). On degree-2 corners (all hard boards), the surviving
      // neighbor has access to ~half the board, so per-neighbor feasibility
      // trivially passes. The check would fire on boards with asymmetric
      // neighbor territories (e.g., general at the mouth of a narrow corridor).
      // Kept because it's cheap (one bigint AND + popcount per neighbor per
      // bucket), and the blankMasks infrastructure is useful for future work.
      // See findings/3.21-l3-per-neighbor-pruning.md.
      if (overlap === 0 && nb.blankMasks.length > moveLen - 1) {
        const captures = moveLen; // overlap=0 → captures = moveLen
        const reachable = popcount(nb.blankMasks[moveLen - 1] & ~coveredMask);
        if (reachable < captures) continue;
      }

      const partition = partitionsAtLen[ni];
      for (const cand of partition) {
        ctx.stats.candidatesChecked++;
        if (overlap === 0) {
          if ((cand.mask & coveredMask) !== 0n) continue;
        } else {
          if (popcount(cand.mask & coveredMask) !== overlap) continue;
          if (countPrefixOverlap(cand.tiles, coveredMask) !== overlap) continue;
        }

        ctx.stats.candidatesPassed++;
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
  const neighborInfos = getNeighborInfos(board, generalPos, cfg.maxBurst);
  const partitioned = buildPartitionedEntries(entriesByLen, neighborInfos);
  // Must cover the longest possible move (captures + overlap) so
  // blankTilesWithinDist always does an exact lookup instead of
  // falling back to the beyondTiles heuristic, which underestimates.
  const feasMaxDist = cfg.maxBurst + cfg.maxOverlapPerBurst;
  const blankTileMasks = precomputeBlankTileDistMasks(board, generalPos, feasMaxDist);

  const tPathGenDone = cfg.profile ? performance.now() : 0;

  const timingConfig: TimingTableConfig = {
    maxTicks: cfg.maxTicks,
    maxBurst: cfg.maxBurst,
    maxBursts: cfg.maxBursts,
    maxOverlapPerBurst: cfg.maxOverlapPerBurst,
  };

  let entriesChecked = 0;
  const stats = emptyStats(cfg.profile);
  const ctx: SearchContext = {
    partitioned,
    neighborInfos,
    blankTileMasks,
    stats,
    profile: cfg.profile,
  };

  const targetProfiles: TargetProfile[] | null = cfg.profile ? [] : null;

  for (let captures = cfg.maxCaptures; captures >= cfg.minCaptures; captures--) {
    const tTargetStart = cfg.profile ? performance.now() : 0;
    const prevEntries = cfg.profile ? entriesChecked : 0;
    const prevChecked = cfg.profile ? stats.candidatesChecked : 0;
    const prevPassed = cfg.profile ? stats.candidatesPassed : 0;
    const prevSearchCalls = cfg.profile ? stats.searchCalls : 0;
    const prevFeasChecks = cfg.profile ? stats.feasibilityChecks : 0;
    const prevFeasPrunes = cfg.profile ? stats.feasibilityPrunes : 0;
    const prevFeasKilled = cfg.profile ? stats.feasibilityEntriesKilled : 0;
    const prevFeasProfile =
      cfg.profile && stats.feasProfile ? { ...stats.feasProfile } : null;

    const groups = buildTimingGroups(captures, timingConfig, entriesByLen);
    const totalTimingEntries = cfg.profile
      ? groups.reduce((s, g) => s + g.entries.length, 0)
      : 0;

    const tSearchStart = cfg.profile ? performance.now() : 0;

    const buildTargetProfile = (): TargetProfile => ({
      captures,
      timingTableMs: tSearchStart - tTargetStart,
      searchMs: performance.now() - tSearchStart,
      groupCount: groups.length,
      totalTimingEntries,
      burst1Entries: entriesChecked - prevEntries,
      candidatesChecked: stats.candidatesChecked - prevChecked,
      candidatesPassed: stats.candidatesPassed - prevPassed,
      searchCalls: stats.searchCalls - prevSearchCalls,
      feasibilityChecks: stats.feasibilityChecks - prevFeasChecks,
      feasibilityPrunes: stats.feasibilityPrunes - prevFeasPrunes,
      feasibilityEntriesKilled: stats.feasibilityEntriesKilled - prevFeasKilled,
      feasProfile:
        prevFeasProfile && stats.feasProfile
          ? feasProfileDelta(stats.feasProfile, prevFeasProfile)
          : null,
    });

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

          if (targetProfiles) {
            targetProfiles.push(buildTargetProfile());
          }

          return {
            solution,
            entriesChecked,
            elapsedMs: performance.now() - t0,
            stats,
            profileData: targetProfiles
              ? { pathGenMs: tPathGenDone - t0, targets: targetProfiles }
              : null,
          };
        }
      }
    }

    if (targetProfiles) {
      targetProfiles.push(buildTargetProfile());
    }
  }

  return {
    solution: null,
    entriesChecked,
    elapsedMs: performance.now() - t0,
    stats,
    profileData: targetProfiles
      ? { pathGenMs: tPathGenDone - t0, targets: targetProfiles }
      : null,
  };
}

export type {
  EntryWithMoves,
  FeasibilityProfile,
  FeasProfileKey,
  NeighborInfo,
  PartitionedEntries,
  ProfileData,
  SearchContext,
  SearchResult,
  SearchStats,
  Solution,
  SolverConfig,
  SolverResult,
  TargetProfile,
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
  getNeighborInfos,
  precomputeBlankTileDistMasks,
  solveV3,
};

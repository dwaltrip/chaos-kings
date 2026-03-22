// 3.2 Neighbor Partitioning — Level 2: Explicit neighbor assignment
// Enumerate burst→neighbor assignments for zero-overlap bursts, search within
// single partitions per depth. Compare against baseline solveV3.
//
// Key change from Level 1: instead of iterating all compatible neighbor
// partitions at each depth, zero-overlap bursts are assigned to specific
// neighbors upfront. The search at each depth goes to exactly one partition.
// Overlap bursts still iterate covered partitions (same as L1).
//
// Trade-off: no timing-entry grouping (entries processed individually).
// The hypothesis is that single-partition search + assignment pruning
// compensates for losing amortization across entries.
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.20-3-neighbor-assignment.ts
//        npx tsx ... [boardName]      — run on a single board
//        npx tsx ... --all            — run on all boards

import { Direction } from '@core/types';

import { Board, TileType, type FlatBoard } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { popcount } from '../../custom-algo-1/bitmask';
import { genPathsDP } from '../../custom-algo-1/gen-paths';
import {
  getBurstInfosFromSpecs,
  type BurstSpec,
} from '../../custom-algo-1/get-burst-info';
import {
  buildPathEntries,
  countPrefixOverlap,
  type PathEntry,
  type PathEntriesByLen,
} from '../../custom-algo-1/path-search';
import {
  type EntryWithMoves,
  type SearchStats,
  type SolverConfig,
  type SolverResult,
  buildTimingGroups,
  DEFAULT_CONFIG,
  emptyStats,
  entryIsFeasibleAggregate,
  entryIsFeasibleNeighbors,
  entryIsFeasiblePerBurst,
  precomputeBlankTileDistMasks,
  solveV3,
} from '../../custom-algo-1/solver-v3';
import { type TimingTableConfig } from '../../custom-algo-1/timing-table';
import { formatTable } from '../../format';
import { allBoards } from '../../test-boards';

// Frozen at the value used when this experiment was run
const FEASIBILITY_MAX_DIST = 4;

// ── Partitioned data structure (reused from L1) ──

type PartitionedEntries = Map<number, Map<number, PathEntry[]>>;

function buildPartitionedEntries(entriesByLen: PathEntriesByLen): PartitionedEntries {
  const result: PartitionedEntries = new Map();

  for (const [len, entries] of entriesByLen) {
    const byNeighbor = new Map<number, PathEntry[]>();
    for (const entry of entries) {
      const neighbor = entry.tiles[0];
      let bucket = byNeighbor.get(neighbor);
      if (!bucket) {
        bucket = [];
        byNeighbor.set(neighbor, bucket);
      }
      bucket.push(entry);
    }
    result.set(len, byNeighbor);
  }

  return result;
}

// ── L2: General neighbors ──

const DIRECTIONS = [Direction.LEFT, Direction.UP, Direction.RIGHT, Direction.DOWN];

function getGeneralNeighbors(board: FlatBoard, generalPos: number): number[] {
  const neighbors: number[] = [];
  for (const dir of DIRECTIONS) {
    const next = Board.neighbor(board, generalPos, dir);
    if (!Board.isValidIndex(board, next)) continue;
    if (board.types[next] === TileType.MOUNTAIN) continue;
    neighbors.push(next);
  }
  return neighbors;
}

// ── L2: Assignment enumeration ──

interface L2Stats extends SearchStats {
  assignmentsGenerated: number;
  entriesPrunedFeasibility: number;
}

function emptyL2Stats(): L2Stats {
  return {
    ...emptyStats(false),
    assignmentsGenerated: 0,
    entriesPrunedFeasibility: 0,
  };
}

// Yields valid burst→neighbor assignments for zero-overlap bursts (indices 1+).
// Prunes assignments where a required partition is empty at the needed length.
function* enumerateAssignments(
  es: EntryWithMoves,
  burst1Neighbor: number,
  allNeighbors: number[],
  partitioned: PartitionedEntries,
): Generator<Map<number, number>> {
  // Collect zero-overlap burst indices (skip burst 0, handled outside)
  const zeroOverlapBursts: number[] = [];
  for (let i = 1; i < es.moves.length; i++) {
    if (es.entry.overlaps[i] === 0) {
      zeroOverlapBursts.push(i);
    }
  }

  if (zeroOverlapBursts.length === 0) {
    // No zero-overlap bursts to assign (all overlap bursts) — yield empty assignment
    yield new Map();
    return;
  }

  // Available neighbors = all neighbors - burst1Neighbor
  const available = allNeighbors.filter((n) => n !== burst1Neighbor);

  function* permute(
    idx: number,
    used: Set<number>,
    current: Map<number, number>,
  ): Generator<Map<number, number>> {
    if (idx === zeroOverlapBursts.length) {
      yield new Map(current);
      return;
    }

    const burstIdx = zeroOverlapBursts[idx];
    const moveLen = es.moves[burstIdx];

    for (const neighbor of available) {
      if (used.has(neighbor)) continue;

      // Upfront pruning: does this partition have candidates at this length?
      const partition = partitioned.get(moveLen)?.get(neighbor);
      if (!partition || partition.length === 0) continue;

      current.set(burstIdx, neighbor);
      used.add(neighbor);
      yield* permute(idx + 1, used, current);
      used.delete(neighbor);
      current.delete(burstIdx);
    }
  }

  yield* permute(0, new Set(), new Map());
}

// ── L2: Search with fixed assignment ──

function searchWithAssignment(
  partitioned: PartitionedEntries,
  es: EntryWithMoves,
  assignment: Map<number, number>,
  burstIdx: number,
  coveredMask: bigint,
  blankTileMasks: bigint[],
  stats: L2Stats,
): PathEntry[] | null {
  stats.searchCalls++;

  if (burstIdx === es.moves.length) return [];

  // Per-entry feasibility
  stats.feasibilityChecks++;
  const blankNeighborCount = popcount(blankTileMasks[1] & ~coveredMask);
  if (!entryIsFeasibleNeighbors(es, burstIdx, blankNeighborCount)) {
    stats.feasibilityPrunes++;
    return null;
  }
  if (!entryIsFeasiblePerBurst(es, burstIdx, coveredMask, blankTileMasks)) {
    stats.feasibilityPrunes++;
    return null;
  }
  if (!entryIsFeasibleAggregate(es, burstIdx, coveredMask, blankTileMasks)) {
    stats.feasibilityPrunes++;
    return null;
  }

  const moveLen = es.moves[burstIdx];
  const overlap = es.entry.overlaps[burstIdx];
  const partitionsAtLen = partitioned.get(moveLen);
  if (!partitionsAtLen) return null;

  if (overlap === 0) {
    // Fixed assignment — search exactly one partition
    const neighbor = assignment.get(burstIdx)!;
    const partition = partitionsAtLen.get(neighbor);
    if (!partition) return null;

    for (const cand of partition) {
      stats.candidatesChecked++;
      if ((cand.mask & coveredMask) !== 0n) continue;

      const newCovered = coveredMask | cand.mask;
      const rest = searchWithAssignment(
        partitioned,
        es,
        assignment,
        burstIdx + 1,
        newCovered,
        blankTileMasks,
        stats,
      );
      if (rest) {
        rest.unshift(cand);
        return rest;
      }
    }
  } else {
    // Overlap burst — iterate covered neighbor partitions (same as L1)
    for (const [neighbor, partition] of partitionsAtLen) {
      const neighborBit = 1n << BigInt(neighbor);
      if (!(coveredMask & neighborBit)) continue; // must be covered

      for (const cand of partition) {
        stats.candidatesChecked++;
        if (popcount(cand.mask & coveredMask) !== overlap) continue;
        if (countPrefixOverlap(cand.tiles, coveredMask) !== overlap) continue;

        const newMask = cand.mask & ~coveredMask;
        const newCovered = coveredMask | newMask;
        const rest = searchWithAssignment(
          partitioned,
          es,
          assignment,
          burstIdx + 1,
          newCovered,
          blankTileMasks,
          stats,
        );
        if (rest) {
          rest.unshift(cand);
          return rest;
        }
      }
    }
  }

  return null;
}

// ── L2 solver ──

interface L2Result extends SolverResult {
  l2Stats: L2Stats;
}

function solveL2(
  board: FlatBoard,
  generalPos: number,
  config: Partial<SolverConfig> = {},
): L2Result {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const t0 = performance.now();

  const pathsByLen = genPathsDP(board, generalPos, cfg.maxBurst + 1);
  const entriesByLen = buildPathEntries(pathsByLen);
  const partitioned = buildPartitionedEntries(entriesByLen);
  const blankTileMasks = precomputeBlankTileDistMasks(
    board,
    generalPos,
    FEASIBILITY_MAX_DIST,
  );
  const generalNeighbors = getGeneralNeighbors(board, generalPos);

  const timingConfig: TimingTableConfig = {
    maxTicks: cfg.maxTicks,
    maxBurst: cfg.maxBurst,
    maxBursts: cfg.maxBursts,
    maxOverlapPerBurst: cfg.maxOverlapPerBurst,
  };

  let entriesChecked = 0;
  const stats = emptyL2Stats();

  for (let captures = cfg.maxCaptures; captures >= cfg.minCaptures; captures--) {
    const groups = buildTimingGroups(captures, timingConfig, entriesByLen);

    for (const group of groups) {
      const candidates = entriesByLen.get(group.burst1Moves);
      if (!candidates) continue;
      if (group.entries.length === 0) continue;

      for (const b1Cand of candidates) {
        entriesChecked++;
        const burst1Neighbor = b1Cand.tiles[0];

        for (const es of group.entries) {
          // Per-entry feasibility at depth 1 (avoid assignment enumeration
          // for entries that are infeasible after burst-1)
          const blankNeighborCount = popcount(blankTileMasks[1] & ~b1Cand.mask);
          if (
            !entryIsFeasibleNeighbors(es, 1, blankNeighborCount) ||
            !entryIsFeasiblePerBurst(es, 1, b1Cand.mask, blankTileMasks) ||
            !entryIsFeasibleAggregate(es, 1, b1Cand.mask, blankTileMasks)
          ) {
            stats.entriesPrunedFeasibility++;
            continue;
          }

          for (const assignment of enumerateAssignments(
            es,
            burst1Neighbor,
            generalNeighbors,
            partitioned,
          )) {
            stats.assignmentsGenerated++;

            const result = searchWithAssignment(
              partitioned,
              es,
              assignment,
              1,
              b1Cand.mask,
              blankTileMasks,
              stats,
            );
            if (result) {
              const paths = [b1Cand, ...result];
              const entry = es.entry;
              const moves = entry.captures.map((c, i) => c + entry.overlaps[i]);
              const burstSpecs: BurstSpec[] = entry.captures.map((c, i) => ({
                captures: c,
                moves: moves[i],
              }));

              let solvedMask = 0n;
              for (const p of paths) solvedMask |= p.mask;

              // @ts-ignore — old experiment, missing profileData field
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
                l2Stats: stats,
              };
            }
          }
        }
      }
    }
  }

  // @ts-ignore — old experiment, missing profileData field
  return {
    solution: null,
    entriesChecked,
    elapsedMs: performance.now() - t0,
    stats,
    l2Stats: stats,
  };
}

// ── Experiment harness ──

interface RunResult {
  boardName: string;
  baselineMs: number;
  l2Ms: number;
  speedup: number;
  baselineCandidates: number;
  l2Candidates: number;
  candidateReduction: number;
  baselineCaptures: number | null;
  l2Captures: number | null;
  capturesMatch: boolean;
  l2Stats: L2Stats;
}

function runComparison(
  boardName: string,
  board: FlatBoard,
  generalPos: number,
  warmupRuns: number,
  timedRuns: number,
): RunResult {
  // Warmup
  for (let i = 0; i < warmupRuns; i++) {
    solveV3(board, generalPos);
    solveL2(board, generalPos);
  }

  // Timed runs — interleaved to control for thermal effects
  const baselineTimes: number[] = [];
  const l2Times: number[] = [];
  let baselineResult: SolverResult | null = null;
  let l2Result: L2Result | null = null;

  for (let i = 0; i < timedRuns; i++) {
    const br = solveV3(board, generalPos);
    baselineTimes.push(br.elapsedMs);
    baselineResult = br;

    const lr = solveL2(board, generalPos);
    l2Times.push(lr.elapsedMs);
    l2Result = lr;
  }

  baselineTimes.sort((a, b) => a - b);
  l2Times.sort((a, b) => a - b);
  const baselineMs = baselineTimes[Math.floor(timedRuns / 2)];
  const l2Ms = l2Times[Math.floor(timedRuns / 2)];

  const baseCap = baselineResult!.solution?.totalCaptured ?? null;
  const l2Cap = l2Result!.solution?.totalCaptured ?? null;

  return {
    boardName,
    baselineMs,
    l2Ms,
    speedup: baselineMs / l2Ms,
    baselineCandidates: baselineResult!.stats.candidatesChecked,
    l2Candidates: l2Result!.l2Stats.candidatesChecked,
    candidateReduction:
      baselineResult!.stats.candidatesChecked > 0
        ? 1 -
          l2Result!.l2Stats.candidatesChecked / baselineResult!.stats.candidatesChecked
        : 0,
    baselineCaptures: baseCap,
    l2Captures: l2Cap,
    capturesMatch:
      baseCap === l2Cap || (l2Cap !== null && baseCap !== null && l2Cap >= baseCap),
    l2Stats: l2Result!.l2Stats,
  };
}

function main() {
  const arg = process.argv[2];
  const boards = allBoards();

  let selectedBoards: typeof boards;
  if (arg === '--all' || !arg) {
    selectedBoards = boards;
  } else {
    const found = boards.find((b) => b.name === arg);
    if (!found) {
      console.error(`Board not found: ${arg}`);
      console.error(`Available: ${boards.map((b) => b.name).join(', ')}`);
      process.exit(1);
    }
    selectedBoards = [found];
  }

  const WARMUP = 3;
  const TIMED = 7;
  const results: RunResult[] = [];

  console.log(
    `Level 2: Explicit neighbor assignment (${WARMUP} warmup, ${TIMED} timed runs)\n`,
  );
  console.log(
    'Comparing baseline (solveV3) vs L2 (explicit neighbor assignment).\n' +
      'L1 reference numbers from findings/3.2-neighbor-partitioning-level-1.md\n',
  );

  for (const testBoard of selectedBoards) {
    const board = fromBoardState(testBoard.board, 1);
    const generalPos = Board.toIndex(
      board,
      testBoard.generalCoord.x,
      testBoard.generalCoord.y,
    );

    process.stdout.write(`${testBoard.name}... `);
    const result = runComparison(testBoard.name, board, generalPos, WARMUP, TIMED);
    results.push(result);

    const warn = !result.capturesMatch ? ' *** CAPTURE MISMATCH ***' : '';
    console.log(
      `${result.baselineMs.toFixed(1)}ms → ${result.l2Ms.toFixed(1)}ms ` +
        `(${result.speedup.toFixed(2)}x), ` +
        `cands: ${result.baselineCandidates} → ${result.l2Candidates} ` +
        `(-${(result.candidateReduction * 100).toFixed(0)}%), ` +
        `assigns: ${result.l2Stats.assignmentsGenerated}` +
        `${warn}`,
    );
  }

  // Summary table
  const totalBaseMs = results.reduce((s, r) => s + r.baselineMs, 0);
  const totalL2Ms = results.reduce((s, r) => s + r.l2Ms, 0);
  const totalBaseCands = results.reduce((s, r) => s + r.baselineCandidates, 0);
  const totalL2Cands = results.reduce((s, r) => s + r.l2Candidates, 0);
  const totalAssigns = results.reduce((s, r) => s + r.l2Stats.assignmentsGenerated, 0);
  const mismatches = results.filter((r) => !r.capturesMatch);

  const summaryHeaders = [
    'Board',
    'Base ms',
    'L2 ms',
    'Speedup',
    'Base cands',
    'L2 cands',
    'Cand -%',
    'Assigns',
    'Cap B',
    'Cap L2',
  ];
  const summaryRows = results.map((r) => {
    const warn = !r.capturesMatch ? ' !!!' : '';
    return [
      r.boardName,
      r.baselineMs.toFixed(1),
      r.l2Ms.toFixed(1),
      r.speedup.toFixed(2) + 'x',
      String(r.baselineCandidates),
      String(r.l2Candidates),
      (r.candidateReduction * 100).toFixed(0) + '%',
      String(r.l2Stats.assignmentsGenerated),
      String(r.baselineCaptures ?? '-'),
      String(r.l2Captures ?? '-') + warn,
    ];
  });
  summaryRows.push([
    'TOTAL',
    totalBaseMs.toFixed(1),
    totalL2Ms.toFixed(1),
    (totalBaseMs / totalL2Ms).toFixed(2) + 'x',
    String(totalBaseCands),
    String(totalL2Cands),
    ((1 - totalL2Cands / totalBaseCands) * 100).toFixed(0) + '%',
    String(totalAssigns),
    '',
    '',
  ]);

  console.log('\n# Summary\n');
  console.log(formatTable(summaryHeaders, summaryRows));

  if (mismatches.length > 0) {
    console.log(
      `\n*** ${mismatches.length} capture mismatches: ${mismatches.map((r) => r.boardName).join(', ')}`,
    );
  }

  // L2-specific stats detail
  const detailHeaders = [
    'Board',
    'Assigns',
    'Entries pruned',
    'Search calls',
    'Feas prunes',
    'Feas killed',
  ];
  const detailRows = results.map((r) => [
    r.boardName,
    String(r.l2Stats.assignmentsGenerated),
    String(r.l2Stats.entriesPrunedFeasibility),
    String(r.l2Stats.searchCalls),
    String(r.l2Stats.feasibilityPrunes),
    String(r.l2Stats.feasibilityEntriesKilled),
  ]);

  console.log('\n# L2 Stats Detail\n');
  console.log(formatTable(detailHeaders, detailRows));
}

main();

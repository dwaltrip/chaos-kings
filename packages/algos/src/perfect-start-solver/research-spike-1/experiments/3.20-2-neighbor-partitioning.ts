// 3.2 Neighbor Partitioning — Level 1
// Partition candidates by tiles[0] (starting neighbor), skip irrelevant
// partitions based on coveredMask. Compare against baseline solveV3.
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.20-2-neighbor-partitioning.ts
//        npx tsx ... [boardName]      — run on a single board
//        npx tsx ... --all            — run on all boards

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { formatTable } from '../../format';

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
  type SearchResult,
  type SearchStats,
  type Solution,
  type SolverConfig,
  type SolverResult,
  type TimingGroup,
  BucketKey,
  buildTimingGroups,
  DEFAULT_CONFIG,
  emptyStats,
  entryIsFeasibleAggregate,
  entryIsFeasibleNeighbors,
  entryIsFeasiblePerBurst,
  FEASIBILITY_MAX_DIST,
  precomputeBlankTileDistMasks,
  solveV3,
} from '../../custom-algo-1/solver-v3';
import { type TimingTableConfig } from '../../custom-algo-1/timing-table';
import { allBoards } from '../../test-boards';

// ── Partitioned data structure ──

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

// ── Modified searchGrouped with neighbor partitioning ──

function searchGroupedPartitioned(
  partitioned: PartitionedEntries,
  entries: EntryWithMoves[],
  burstIdx: number,
  coveredMask: bigint,
  blankTileMasks: bigint[],
  stats: SearchStats,
): SearchResult | null {
  stats.searchCalls++;

  for (const es of entries) {
    if (burstIdx === es.moves.length) {
      return { entry: es.entry, paths: [] };
    }
  }

  stats.feasibilityChecks++;
  const blankNeighborCount = popcount(blankTileMasks[1] & ~coveredMask);
  const feasible = entries.filter(
    (es) =>
      entryIsFeasibleNeighbors(es, burstIdx, blankNeighborCount) &&
      entryIsFeasiblePerBurst(es, burstIdx, coveredMask, blankTileMasks) &&
      entryIsFeasibleAggregate(es, burstIdx, coveredMask, blankTileMasks),
  );
  stats.feasibilityEntriesKilled += entries.length - feasible.length;
  if (feasible.length === 0) {
    stats.feasibilityPrunes++;
    return null;
  }

  const buckets = new Map<number, EntryWithMoves[]>();
  for (const es of feasible) {
    const key = BucketKey.pack(es.moves[burstIdx], es.entry.overlaps[burstIdx]);
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
    const partitionsAtLen = partitioned.get(moveLen);
    if (!partitionsAtLen) continue;

    // Iterate only relevant neighbor partitions
    for (const [neighbor, partition] of partitionsAtLen) {
      const neighborBit = 1n << BigInt(neighbor);
      const neighborCovered = (coveredMask & neighborBit) !== 0n;

      // Zero-overlap: tiles[0] must NOT be covered
      // Overlap: tiles[0] MUST be covered (it's part of the prefix)
      if (overlap === 0 && neighborCovered) continue;
      if (overlap > 0 && !neighborCovered) continue;

      for (const cand of partition) {
        stats.candidatesChecked++;
        if (overlap === 0) {
          if ((cand.mask & coveredMask) !== 0n) continue;
        } else {
          if (popcount(cand.mask & coveredMask) !== overlap) continue;
          if (countPrefixOverlap(cand.tiles, coveredMask) !== overlap) continue;
        }

        const newMask = overlap > 0 ? cand.mask & ~coveredMask : cand.mask;
        const newCovered = coveredMask | newMask;

        const result = searchGroupedPartitioned(
          partitioned,
          bucket,
          burstIdx + 1,
          newCovered,
          blankTileMasks,
          stats,
        );
        if (result) {
          result.paths.unshift(cand);
          return result;
        }
      }
    }
  }

  return null;
}

// ── Partitioned solver ──

function solvePartitioned(
  board: Parameters<typeof solveV3>[0],
  generalPos: number,
  config: Partial<SolverConfig> = {},
): SolverResult {
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

  const timingConfig: TimingTableConfig = {
    maxTicks: cfg.maxTicks,
    maxBurst: cfg.maxBurst,
    maxBursts: cfg.maxBursts,
    maxOverlapPerBurst: cfg.maxOverlapPerBurst,
  };

  let entriesChecked = 0;
  const stats = emptyStats(false);

  for (let captures = cfg.maxCaptures; captures >= cfg.minCaptures; captures--) {
    const groups = buildTimingGroups(captures, timingConfig, entriesByLen);

    for (const group of groups) {
      const candidates = entriesByLen.get(group.burst1Moves);
      if (!candidates) continue;
      if (group.entries.length === 0) continue;

      for (const cand of candidates) {
        entriesChecked++;
        const result = searchGroupedPartitioned(
          partitioned,
          group.entries,
          1,
          cand.mask,
          blankTileMasks,
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
          };
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
  };
}

// ── Experiment harness ──

interface RunResult {
  boardName: string;
  baselineMs: number;
  partitionedMs: number;
  speedup: number;
  baselineCandidates: number;
  partitionedCandidates: number;
  candidateReduction: number;
  baselineCaptures: number | null;
  partitionedCaptures: number | null;
  capturesMatch: boolean;
}

function runComparison(
  boardName: string,
  board: Parameters<typeof solveV3>[0],
  generalPos: number,
  warmupRuns: number,
  timedRuns: number,
): RunResult {
  // Warmup
  for (let i = 0; i < warmupRuns; i++) {
    solveV3(board, generalPos);
    solvePartitioned(board, generalPos);
  }

  // Timed runs — interleaved to control for thermal effects
  const baselineTimes: number[] = [];
  const partitionedTimes: number[] = [];
  let baselineResult: SolverResult | null = null;
  let partitionedResult: SolverResult | null = null;

  for (let i = 0; i < timedRuns; i++) {
    const br = solveV3(board, generalPos);
    baselineTimes.push(br.elapsedMs);
    baselineResult = br;

    const pr = solvePartitioned(board, generalPos);
    partitionedTimes.push(pr.elapsedMs);
    partitionedResult = pr;
  }

  baselineTimes.sort((a, b) => a - b);
  partitionedTimes.sort((a, b) => a - b);
  const baselineMs = baselineTimes[Math.floor(timedRuns / 2)];
  const partitionedMs = partitionedTimes[Math.floor(timedRuns / 2)];

  const baseCap = baselineResult!.solution?.totalCaptured ?? null;
  const partCap = partitionedResult!.solution?.totalCaptured ?? null;

  return {
    boardName,
    baselineMs,
    partitionedMs,
    speedup: baselineMs / partitionedMs,
    baselineCandidates: baselineResult!.stats.candidatesChecked,
    partitionedCandidates: partitionedResult!.stats.candidatesChecked,
    candidateReduction:
      baselineResult!.stats.candidatesChecked > 0
        ? 1 -
          partitionedResult!.stats.candidatesChecked /
            baselineResult!.stats.candidatesChecked
        : 0,
    baselineCaptures: baseCap,
    partitionedCaptures: partCap,
    capturesMatch:
      baseCap === partCap || (partCap !== null && baseCap !== null && partCap >= baseCap),
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
    `Running neighbor partitioning experiment (${WARMUP} warmup, ${TIMED} timed runs)\n`,
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
      `${result.baselineMs.toFixed(1)}ms → ${result.partitionedMs.toFixed(1)}ms ` +
        `(${result.speedup.toFixed(2)}x), ` +
        `cands: ${result.baselineCandidates} → ${result.partitionedCandidates} ` +
        `(-${(result.candidateReduction * 100).toFixed(0)}%)` +
        `${warn}`,
    );
  }

  // Summary table
  const totalBaseMs = results.reduce((s, r) => s + r.baselineMs, 0);
  const totalPartMs = results.reduce((s, r) => s + r.partitionedMs, 0);
  const totalBaseCands = results.reduce((s, r) => s + r.baselineCandidates, 0);
  const totalPartCands = results.reduce((s, r) => s + r.partitionedCandidates, 0);
  const mismatches = results.filter((r) => !r.capturesMatch);

  const headers = [
    'Board',
    'Base ms',
    'Part ms',
    'Speedup',
    'Base cands',
    'Part cands',
    'Cand -%',
    'Cap B',
    'Cap P',
  ];
  const rows = results.map((r) => {
    const warn = !r.capturesMatch ? ' !!!' : '';
    return [
      r.boardName,
      r.baselineMs.toFixed(1),
      r.partitionedMs.toFixed(1),
      r.speedup.toFixed(2) + 'x',
      String(r.baselineCandidates),
      String(r.partitionedCandidates),
      (r.candidateReduction * 100).toFixed(0) + '%',
      String(r.baselineCaptures ?? '-'),
      String(r.partitionedCaptures ?? '-') + warn,
    ];
  });
  rows.push([
    'TOTAL',
    totalBaseMs.toFixed(1),
    totalPartMs.toFixed(1),
    (totalBaseMs / totalPartMs).toFixed(2) + 'x',
    String(totalBaseCands),
    String(totalPartCands),
    ((1 - totalPartCands / totalBaseCands) * 100).toFixed(0) + '%',
    '',
    '',
  ]);

  console.log('\n# Summary\n');
  console.log(formatTable(headers, rows));

  if (mismatches.length > 0) {
    console.log(
      `\n*** ${mismatches.length} capture mismatches: ${mismatches.map((r) => r.boardName).join(', ')}`,
    );
  }
}

main();

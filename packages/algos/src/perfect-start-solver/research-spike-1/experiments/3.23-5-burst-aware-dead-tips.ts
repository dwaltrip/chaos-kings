import { Board, type FlatBoard } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { slowSearch, TestBoard } from '../../test-boards';
import { getWalkableNeighbors } from '../../utils/board-graph';

import { buildTimingEntries } from '../../custom-algo-1/timing-table';
import { enumeratePrefixes, enumeratePrefixSets } from '../prefix-utils';

const SLOW_BOARDS = slowSearch();

const D = 4;
const MAX_PATH_LEN = 12;

// Per-burst tip freedom for a prefix set — precomputed once per set.
// deadBursts[i] = true if burst i's tip has free=0 against the full set.
function computeDeadBursts(
  prefixTiles: number[][],
  generalPos: number,
  board: FlatBoard,
): boolean[] {
  // Collect all tiles across all prefixes + general
  const allTiles = new Set([generalPos]);
  for (const tiles of prefixTiles) {
    for (const t of tiles) allTiles.add(t);
  }

  return prefixTiles.map((tiles) => {
    const tip = tiles[tiles.length - 1];
    const neighbors = getWalkableNeighbors(board, tip);
    const free = neighbors.filter((nb) => !allTiles.has(nb)).length;
    return free === 0;
  });
}

// Group timing entries by overlap pattern. For each overlap pattern,
// collect all unique pathLen arrays (from different capture distributions).
interface OverlapGroup {
  overlaps: number[];
  // All distinct per-burst path-length arrays for this overlap pattern.
  pathLenVariants: number[][];
}

type GroupsByN = Map<number, OverlapGroup[]>;

function buildOverlapGroups(): GroupsByN {
  const config = { maxTicks: 50, maxBurst: 12, maxBursts: 6, maxOverlapPerBurst: 3 };
  const groupsByN: GroupsByN = new Map();

  // Collect unique (overlaps, pathLens) pairs grouped by overlaps.
  const overlapMap = new Map<string, { overlaps: number[]; pathLenSet: Set<string> }>();

  for (let cap = 20; cap <= 24; cap++) {
    for (const entry of buildTimingEntries(cap, config)) {
      const ovlKey = entry.overlaps.join(',');
      if (!overlapMap.has(ovlKey)) {
        overlapMap.set(ovlKey, { overlaps: entry.overlaps, pathLenSet: new Set() });
      }
      const pathLens = entry.captures.map((c, i) => c + entry.overlaps[i]);
      overlapMap.get(ovlKey)!.pathLenSet.add(pathLens.join(','));
    }
  }

  // Convert to grouped structure.
  for (const { overlaps, pathLenSet } of overlapMap.values()) {
    const N = overlaps.length;
    if (!groupsByN.has(N)) groupsByN.set(N, []);
    const pathLenVariants = [...pathLenSet].map((s) => s.split(',').map(Number));
    groupsByN.get(N)!.push({ overlaps, pathLenVariants });
  }

  return groupsByN;
}

function analyzeBoard(tb: TestBoard, groupsByN: GroupsByN) {
  const t0 = performance.now();
  const board = fromBoardState(tb.board, 1);
  const gp = Board.toIndex(board, tb.generalCoord.x, tb.generalCoord.y);
  const { prefixesByDepth } = enumeratePrefixes(board, gp, D, MAX_PATH_LEN);

  const lines: string[] = [];

  for (const N of [4, 5, 6]) {
    const groups = groupsByN.get(N) ?? [];

    // Totals are over (prefix set, pathLen variant) pairs.
    let totalPairs = 0;
    let deadNaive = 0;
    let deadBurstAware = 0;

    for (const group of groups) {
      const result = enumeratePrefixSets(
        prefixesByDepth,
        group.overlaps,
        D,
        10_000,
        // true,
        false,
      );

      for (const s of result.sets) {
        // Precompute which bursts have dead tips (once per set).
        const deadBursts = computeDeadBursts(s.prefixTiles, gp, board);
        const anyDead = deadBursts.some(Boolean);

        // Cross with all path-length variants for this overlap pattern.
        for (const pathLens of group.pathLenVariants) {
          totalPairs++;

          if (anyDead) deadNaive++;

          // Burst-aware: dead tip only matters if pathLen > D.
          const deadAware = deadBursts.some((dead, i) => dead && pathLens[i] > D);
          if (deadAware) deadBurstAware++;
        }
      }
    }

    const pctNaive = totalPairs > 0 ? ((deadNaive / totalPairs) * 100).toFixed(1) : '-';
    const pctAware =
      totalPairs > 0 ? ((deadBurstAware / totalPairs) * 100).toFixed(1) : '-';
    const aliveNaive = totalPairs - deadNaive;
    const aliveAware = totalPairs - deadBurstAware;

    lines.push(`  N=${N}: total=${totalPairs}`);
    lines.push(`    naive:       ${deadNaive} dead (${pctNaive}%), ${aliveNaive} alive`);
    lines.push(
      `    burst-aware: ${deadBurstAware} dead (${pctAware}%), ${aliveAware} alive`,
    );
  }

  const elapsed = performance.now() - t0;
  console.log(`## ${tb.name}  (${elapsed.toFixed(0)}ms)`);
  for (const line of lines) console.log(line);
  console.log();
}

function main() {
  const t0 = performance.now();
  const groupsByN = buildOverlapGroups();
  const setupMs = performance.now() - t0;

  // Log stats for context.
  console.log('# Burst-Aware Dead-Tip Analysis (D=' + D + ')\n');
  console.log(`Setup: ${setupMs.toFixed(0)}ms`);
  console.log('Overlap groups and path-length variants:');
  for (const N of [4, 5, 6]) {
    const groups = groupsByN.get(N) ?? [];
    const totalVariants = groups.reduce((s, g) => s + g.pathLenVariants.length, 0);
    const withShort = groups.reduce(
      (s, g) => s + g.pathLenVariants.filter((pl) => pl.some((l) => l <= D)).length,
      0,
    );
    console.log(
      `  N=${N}: ${groups.length} overlap patterns, ${totalVariants} path-len variants, ${withShort} have a burst with pathLen≤${D}`,
    );
  }
  console.log();

  for (const testBoard of SLOW_BOARDS) {
    analyzeBoard(testBoard, groupsByN);
  }
}

main();

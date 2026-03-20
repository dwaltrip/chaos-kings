// Per-capture-level profiling of the v2 solver.
// Shows entries checked, skipped, time per level, with timeout support.
//
// Usage:
//   npx tsx profile-solve.ts --board corner-9x9
//   npx tsx profile-solve.ts --board all --timeout 5000
//   npx tsx profile-solve.ts --board corner-9x9 --captures 20-24

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';
import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards, makeBoard } from '../../test-boards';
import { popcount } from '../bitmask';
import { genPathsDP } from '../gen-paths';
import {
  buildPathEntries,
  countPrefixOverlap,
  type PathEntry,
  type PathEntriesByLen,
} from '../path-search';
import {
  buildTimingEntries,
  type TimingEntry,
  type TimingTableConfig,
} from '../timing-table';

interface Options {
  board: string;
  timeout: string;
  captures: string;
  maxBurst: string;
  maxBursts: string;
  maxOverlap: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<Options>()
    .name('profile-solve')
    .description('Per-capture-level solver profiling with timeout')
    .option('--board <names>', 'Board names, comma-separated', 'all')
    .option('--timeout <ms>', 'Timeout per capture level in ms (0=none)', '5000')
    .option('--captures <range>', 'Capture range, e.g. "24" or "20-24"', '15-24')
    .option('--max-burst <n>', 'Max burst length', '12')
    .option('--max-bursts <n>', 'Max number of bursts', '6')
    .option('--max-overlap <n>', 'Max overlap per burst', '3'),
);

const timeout = Number(opts.timeout);
const maxBurst = Number(opts.maxBurst);
const maxBursts = Number(opts.maxBursts);
const maxOverlap = Number(opts.maxOverlap);

const [capLo, capHi] = opts.captures.includes('-')
  ? opts.captures.split('-').map(Number)
  : [Number(opts.captures), Number(opts.captures)];

const boards =
  opts.board === 'all' ? allBoards() : opts.board.split(',').map((n) => makeBoard(n));

const timingConfig: TimingTableConfig = {
  maxTicks: 50,
  maxBurst,
  maxBursts,
  maxOverlapPerBurst: maxOverlap,
};

interface LevelStats {
  captures: number;
  totalEntries: number;
  skipped: number;
  searched: number;
  found: boolean;
  elapsedMs: number;
  timedOut: boolean;
}

// Spatial search with fixed move lengths (same as solver-v2's findPathsFixed)
function findPathsFixed(
  entriesByLen: PathEntriesByLen,
  entry: TimingEntry,
  moves: number[],
): PathEntry[] | null {
  const numBursts = moves.length;

  function search(burstIdx: number, coveredMask: bigint): PathEntry[] | null {
    if (burstIdx === numBursts) return [];

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
      const rest = search(burstIdx + 1, coveredMask | newTiles);
      if (rest) {
        rest.unshift(cand);
        return rest;
      }
    }

    return null;
  }

  return search(0, 0n);
}

function profileBoard(
  entriesByLen: PathEntriesByLen,
  capHi: number,
  capLo: number,
): LevelStats[] {
  const levels: LevelStats[] = [];

  for (let captures = capHi; captures >= capLo; captures--) {
    const t0 = performance.now();
    const timingEntries = buildTimingEntries(captures, timingConfig);

    let skipped = 0;
    let searched = 0;
    let found = false;
    let timedOut = false;

    for (const entry of timingEntries) {
      const moves = entry.captures.map((c, i) => c + entry.overlaps[i]);
      if (moves.some((m) => !entriesByLen.has(m))) {
        skipped++;
        continue;
      }

      searched++;
      const paths = findPathsFixed(entriesByLen, entry, moves);
      if (paths) {
        found = true;
        break;
      }

      if (timeout > 0 && performance.now() - t0 > timeout) {
        timedOut = true;
        break;
      }
    }

    const elapsedMs = performance.now() - t0;
    levels.push({
      captures,
      totalEntries: timingEntries.length,
      skipped,
      searched,
      found,
      elapsedMs,
      timedOut,
    });

    if (found) break;
  }

  return levels;
}

for (const testBoard of boards) {
  const board = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );

  const t0 = performance.now();
  const pathsByLen = genPathsDP(board, generalPos, maxBurst + 1);
  const entriesByLen = buildPathEntries(pathsByLen);
  const genMs = performance.now() - t0;

  let totalPaths = 0;
  for (const [, entries] of entriesByLen) totalPaths += entries.length;

  console.log(`=== ${testBoard.name} ===`);
  console.log(
    `  ${totalPaths.toLocaleString()} paths (generated in ${genMs.toFixed(0)}ms)`,
  );

  const levels = profileBoard(entriesByLen, capHi, capLo);

  for (const level of levels) {
    const status = level.found
      ? 'FOUND'
      : level.timedOut
        ? `timeout (${timeout}ms)`
        : 'exhausted';
    const pct =
      level.totalEntries > 0
        ? ` (${((level.searched / level.totalEntries) * 100).toFixed(0)}%)`
        : '';
    console.log(
      `  ${level.captures} cap: ${status} — ` +
        `${level.searched}/${level.totalEntries} searched${pct}, ` +
        `${level.skipped} skipped, ${level.elapsedMs.toFixed(0)}ms`,
    );
  }

  const best = levels.find((l) => l.found);
  if (best) {
    console.log(
      `  → Max achievable: ${best.captures} captures (${best.captures + 1} land)`,
    );
  } else {
    console.log(`  → No solution found in range ${capLo}-${capHi}`);
  }
  console.log();
}

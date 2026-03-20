// Deep profiling of the full solver pipeline.
// Usage: npx tsx profile-overlap-search.ts [boardName...]
// If no board names given, profiles all boards.

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards } from '../../test-boards';
import { genPathsDP } from '../gen-paths';
import { buildPathEntries, findPaths, type OverlapConfig } from '../path-search';
import { genDescendingPartitions, genValidBurstPatterns } from '../burst-patterns';
import { solve } from '../solver';

const MAX_TICKS = 50;
const MAX_BURST = 12;
const MAX_BURSTS = 8;

const overlapConfig: OverlapConfig = { maxOverlapPerBurst: 3, maxTicks: MAX_TICKS };

const boardNames = process.argv.slice(2);
const boards = allBoards().filter(
  (b) => boardNames.length === 0 || boardNames.includes(b.name),
);

// ── Phase 1: Pattern generation ──
console.log('=== Pattern generation ===');
for (const total of [22, 23, 24]) {
  const t0 = performance.now();
  const allPartitions = genDescendingPartitions(total, MAX_BURST);
  const t1 = performance.now();
  const capped = genDescendingPartitions(total, MAX_BURST, MAX_BURSTS);
  const t2 = performance.now();
  const valid = genValidBurstPatterns(total, MAX_BURST, MAX_TICKS, MAX_BURSTS);
  const t3 = performance.now();
  console.log(
    `  total=${total}: partitions=${allPartitions.length} (${(t1 - t0).toFixed(1)}ms)` +
      ` → capped=${capped.length} (${(t2 - t1).toFixed(1)}ms)` +
      ` → valid=${valid.length} (${(t3 - t2).toFixed(1)}ms)`,
  );
}

// ── Phase 2: Per-board profiling ──
for (const testBoard of boards) {
  const board = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );

  console.log(`\n=== ${testBoard.name} ===`);

  // path generation
  const t0 = performance.now();
  const pathsByLen = genPathsDP(board, generalPos, MAX_BURST + 1);
  const t1 = performance.now();
  const entries = buildPathEntries(pathsByLen);
  const t2 = performance.now();

  let totalPaths = 0;
  const lenCounts: string[] = [];
  for (let l = 1; l <= MAX_BURST; l++) {
    const e = entries.get(l);
    if (e) {
      totalPaths += e.length;
      lenCounts.push(`${l}:${e.length}`);
    }
  }
  console.log(
    `  genPathsDP: ${(t1 - t0).toFixed(1)}ms, ` +
      `buildPathEntries: ${(t2 - t1).toFixed(1)}ms, ` +
      `total paths: ${totalPaths}`,
  );
  console.log(`  by length: ${lenCounts.join(', ')}`);

  // per-pattern findPaths (the expensive part)
  const patterns = genValidBurstPatterns(24, MAX_BURST, MAX_TICKS, MAX_BURSTS);
  let checked = 0;
  let skippedByPreFilter = 0;

  for (const pattern of patterns) {
    if (pattern.some((len) => !entries.has(len))) {
      skippedByPreFilter++;
      continue;
    }
    checked++;

    const tp0 = performance.now();
    const result = findPaths(entries, pattern, overlapConfig);
    const ms = performance.now() - tp0;

    if (result || ms > 50) {
      const statsStr = result
        ? result.stats.perBurst.map((s) => `${s.tried}t/${s.overlapSkips}s`).join(', ')
        : '';
      const tag = result ? 'FOUND' : 'miss';
      console.log(
        `  [${checked}] ${JSON.stringify(pattern)}: ${ms.toFixed(0)}ms ${tag}  ${statsStr}`,
      );
    }

    if (result) break;
  }
  console.log(
    `  checked ${checked} patterns, skipped ${skippedByPreFilter} by pre-filter`,
  );

  // full solver for comparison
  const ts0 = performance.now();
  const solverResult = solve(board, generalPos);
  console.log(
    `  solver total: ${Math.round(performance.now() - ts0)}ms, ` +
      `captures=${solverResult.solution?.totalCaptured}, ` +
      `patterns=${solverResult.patternsChecked}`,
  );
}

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards } from '../../test-boards';
import { genPathsDP } from '../gen-paths';
import { buildPathEntries, findPaths } from '../path-search';
import { genValidBurstPatterns } from '../burst-patterns';

const MAX_TICKS = 50;
const MAX_BURST = 12;

// --- Burst pattern generation ---
console.log('=== Burst pattern generation ===');
for (let total = 20; total <= 24; total++) {
  const t0 = performance.now();
  const patterns = genValidBurstPatterns(total, MAX_BURST, MAX_TICKS);
  const elapsed = performance.now() - t0;
  console.log(`  total=${total}: ${patterns.length} patterns in ${elapsed.toFixed(1)}ms`);
}

// --- Per-board operations ---
for (const testBoard of allBoards()) {
  const board = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );

  console.log(`\n=== ${testBoard.name} ===`);

  // path generation
  const t1 = performance.now();
  const pathsByLen = genPathsDP(board, generalPos, MAX_BURST + 1);
  const t2 = performance.now();

  let totalPaths = 0;
  for (const [len, paths] of pathsByLen.entries()) {
    totalPaths += paths.length;
  }
  console.log(`  genPathsDP: ${totalPaths} paths in ${(t2 - t1).toFixed(1)}ms`);

  // path count by length
  const lenCounts: string[] = [];
  for (let l = 1; l <= MAX_BURST + 1; l++) {
    const paths = pathsByLen.get(l);
    if (paths) lenCounts.push(`${l}:${paths.length}`);
  }
  console.log(`    by length: ${lenCounts.join(', ')}`);

  // buildPathEntries
  const t3 = performance.now();
  const entries = buildPathEntries(pathsByLen);
  const t4 = performance.now();
  console.log(`  buildPathEntries: ${(t4 - t3).toFixed(1)}ms`);

  // findPaths for a few representative patterns
  const testPatterns = [
    [12, 7, 3, 2],
    [10, 8, 4, 2],
    [12, 6, 3, 2, 1],
    [8, 6, 4, 3, 2, 1],
  ];

  for (const pattern of testPatterns) {
    const total = pattern.reduce((a, b) => a + b, 0);
    const t5 = performance.now();
    const result = findPaths(entries, pattern);
    const t6 = performance.now();
    const status = result
      ? `found (${result.stats.perBurst.map((b) => `${b.tried}t/${b.overlapSkips}s`).join(', ')})`
      : 'no solution';
    console.log(
      `  findPaths ${JSON.stringify(pattern)} (sum=${total}): ${(t6 - t5).toFixed(2)}ms — ${status}`,
    );
  }

  // full solver: time to first solution
  const patterns24 = genValidBurstPatterns(24, MAX_BURST, MAX_TICKS);
  let checked = 0;
  const t7 = performance.now();
  for (const pattern of patterns24) {
    checked++;
    const result = findPaths(entries, pattern);
    if (result) break;
  }
  const t8 = performance.now();
  console.log(
    `  solver (24 captures): checked ${checked} patterns in ${(t8 - t7).toFixed(1)}ms`,
  );
}

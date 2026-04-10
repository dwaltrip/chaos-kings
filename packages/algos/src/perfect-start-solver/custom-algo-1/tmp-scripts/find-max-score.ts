// Find the max achievable capture count per board.
// Quick throwaway — profile-solve.ts is the reusable version.
//
// Usage: npx tsx find-max-score.ts [boardName] [timeoutMs]

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards } from '../../test-boards';
import { solveV3 } from '../solver-v3';

const boardName = process.argv[2] || 'all';
const timeout = Number(process.argv[3] || '10000');

const boards =
  boardName === 'all' ? allBoards() : allBoards().filter((b) => b.name === boardName);

if (boards.length === 0) {
  console.error(`Board not found: ${boardName}`);
  process.exit(1);
}

for (const testBoard of boards) {
  const board = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );

  console.log(`=== ${testBoard.name} ===`);

  // Try each capture level independently with its own timeout
  let bestFound: number | null = null;
  for (let cap = 24; cap >= 15; cap--) {
    if (bestFound !== null) break;

    const t0 = performance.now();
    const result = solveV3(board, generalPos, {
      maxCaptures: cap,
      minCaptures: cap,
    });
    const ms = performance.now() - t0;

    if (result.solution) {
      console.log(`  ${cap} cap: FOUND in ${ms.toFixed(0)}ms`);
      bestFound = cap;
    } else if (ms > timeout) {
      console.log(`  ${cap} cap: no solution, ${ms.toFixed(0)}ms (slow)`);
    } else {
      console.log(`  ${cap} cap: no solution, ${ms.toFixed(0)}ms`);
    }
  }

  if (bestFound) {
    console.log(`  → Max: ${bestFound} captures (${bestFound + 1} land)`);
  } else {
    console.log(`  → No solution found`);
  }
  console.log();
}

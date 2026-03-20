import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';
import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards, makeBoard } from '../test-boards';
import { solve } from './solver';
import { solveV2 } from './solver-v2';

interface RunOptions {
  board: string;
  ticks: string;
  solver: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<RunOptions>()
    .name('run-custom-algo')
    .description('Run custom-algo-1 burst-path solver')
    .option('--board <names>', 'Board names, comma-separated', 'all')
    .option('--ticks <n>', 'Number of ticks', '50')
    .option('--solver <version>', 'v1, v2, or both', 'v2'),
);

const maxTicks = Number(opts.ticks);
const boards =
  opts.board === 'all' ? allBoards() : opts.board.split(',').map((n) => makeBoard(n));
const runV1 = opts.solver === 'v1' || opts.solver === 'both';
const runV2 = opts.solver === 'v2' || opts.solver === 'both';

for (const testBoard of boards) {
  const board = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );

  console.log(`=== ${testBoard.name} ===`);

  if (runV1) {
    const result = solve(board, generalPos, { maxTicks });
    printResult('v1', result.solution, result.patternsChecked, result.elapsedMs, board);
  }

  if (runV2) {
    const result = solveV2(board, generalPos, { maxTicks });
    printResult('v2', result.solution, result.entriesChecked, result.elapsedMs, board);
  }

  console.log();
}

function printResult(
  label: string,
  solution: any,
  checked: number,
  elapsedMs: number,
  board: { width: number },
) {
  if (!solution) {
    console.log(
      `  [${label}] No solution. Checked ${checked} entries in ${elapsedMs.toFixed(0)}ms`,
    );
    return;
  }

  const s = solution;
  console.log(
    `  [${label}] ${s.totalCaptured} captured, ${elapsedMs.toFixed(0)}ms, ${checked} entries`,
  );
  console.log(
    `    Pattern: ${JSON.stringify(s.pattern)}, last move: t=${s.burstInfos[s.burstInfos.length - 1].endTick}`,
  );

  for (let i = 0; i < s.paths.length; i++) {
    const p = s.paths[i];
    const bi = s.burstInfos[i];
    const spec = s.burstSpecs[i];
    const coords = p.tiles.map((t: number) => {
      const x = t % board.width;
      const y = Math.floor(t / board.width);
      return `(${x},${y})`;
    });
    const overlapStr =
      spec.moves > spec.captures
        ? ` (${spec.captures}cap+${spec.moves - spec.captures}ovlp)`
        : '';
    console.log(
      `    b${i + 1} (${spec.moves}mv) t=${bi.startTick}-${bi.endTick}${overlapStr}: ${coords.join(' ')}`,
    );
  }
}

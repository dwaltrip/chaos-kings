import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';
import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards, makeBoard } from '../test-boards';
import { solve } from './solver';

interface RunOptions {
  board: string;
  ticks: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<RunOptions>()
    .name('run-custom-algo')
    .description('Run custom-algo-1 burst-path solver')
    .option('--board <names>', 'Board names, comma-separated', 'all')
    .option('--ticks <n>', 'Number of ticks', '50'),
);

const maxTicks = Number(opts.ticks);
const boards =
  opts.board === 'all' ? allBoards() : opts.board.split(',').map((n) => makeBoard(n));

for (const testBoard of boards) {
  const board = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );

  console.log(`=== ${testBoard.name} ===`);
  const result = solve(board, generalPos, { maxTicks });

  if (!result.solution) {
    console.log(
      `  No solution found. Checked ${result.patternsChecked} patterns in ${result.elapsedMs.toFixed(0)}ms`,
    );
  } else {
    const s = result.solution;
    console.log(
      `  ${s.totalCaptured} tiles captured (+1 general = ${s.totalCaptured + 1} land)`,
    );
    console.log(`  Pattern: ${JSON.stringify(s.pattern)}`);
    console.log(
      `  Checked ${result.patternsChecked} patterns in ${result.elapsedMs.toFixed(0)}ms`,
    );

    const lastBurst = s.burstInfos[s.burstInfos.length - 1];
    console.log(`  Last move: t=${lastBurst.endTick}`);

    for (let i = 0; i < s.paths.length; i++) {
      const p = s.paths[i];
      const bi = s.burstInfos[i];
      const spec = s.burstSpecs[i];
      const coords = p.tiles.map((t) => {
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

  console.log();
}

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { Board } from '@/core-next/flat-board';
import type { FlatMove } from '@/core-next/process-step';

import { makeBoard } from '../test-boards';

import { runSA } from './sim-anneal';

interface SAOptions {
  board: string;
  ticks: string;
  iterations: string;
  t0: string;
  epsilon: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<SAOptions>()
    .name('run-sa')
    .description('Run simulated annealing on a test board')
    .option('--board <name>', 'Board name', 'open-7x7')
    .option('--ticks <n>', 'Number of ticks', '50')
    .option('--iterations <n>', 'SA iterations', '100000')
    .option('--t0 <n>', 'Initial temperature', '3.0')
    .option('--epsilon <n>', 'Final temperature ratio', '0.001'),
);

const boardName = opts.board;
const totalTicks = Number(opts.ticks);
const iterations = Number(opts.iterations);
const t0 = Number(opts.t0);
const epsilon = Number(opts.epsilon);

function formatFlatMove(move: FlatMove, boardWidth: number): string {
  if (!move) return 'WAIT';
  const { x, y } = Board.toXY({ width: boardWidth } as any, move.src);
  return `(${x},${y})→${move.dir}`;
}

function run() {
  const testBoard = makeBoard(boardName);
  const { board } = testBoard;

  console.log(`Board: ${boardName}`);
  console.log(`Ticks: ${totalTicks}, Iterations: ${iterations.toLocaleString()}`);
  console.log(`T0: ${t0}, epsilon: ${epsilon}`);
  console.log();

  const result = runSA(board, totalTicks, { iterations, t0, epsilon });

  console.log(`Best score: ${result.bestScore}`);
  console.log(
    `Accepted: ${result.acceptedCount.toLocaleString()} / ${result.totalIterations.toLocaleString()} (${((result.acceptedCount / result.totalIterations) * 100).toFixed(1)}%)`,
  );
  console.log(`Runtime: ${(result.runtimeMs / 1000).toFixed(2)}s`);
  console.log(`Progression (best at 10%..100%): [${result.scoreProgression.join(', ')}]`);

  console.log();
  console.log('Best move sequence:');
  for (let i = 0; i < result.bestMoves.length; i++) {
    const move = result.bestMoves[i];
    console.log(
      `  tick ${String(i + 1).padStart(2)}: ${formatFlatMove(move, board.size.width)}`,
    );
  }
}

run();

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { makeBoard } from '../test-boards';

import { createInitialSolution } from './sim-anneal';

interface SAOptions {
  board: string;
  ticks: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<SAOptions>()
    .name('run-sa')
    .description('Run simulated annealing on a test board')
    .option('--board <name>', 'Board name (default: open-7x7)', 'open-7x7')
    .option('--ticks <n>', 'Number of ticks (default: 50)', '50'),
);

const boardName = opts.board;
const totalTicks = Number(opts.ticks);

function run() {
  const testBoard = makeBoard(boardName);
  const { board, generalCoord } = testBoard;

  console.log(`Board: ${boardName}, general at (${generalCoord.x}, ${generalCoord.y})`);
  console.log(`Ticks: ${totalTicks}`);
  console.log();

  const solution = createInitialSolution(board, totalTicks);

  console.log(`Initial solution (all WAITs):`);
  console.log(`  Score: ${solution.score}`);
  console.log(
    `  State cache length: ${solution.stateCache.length} (${totalTicks} ticks + initial)`,
  );

  const finalBoard = solution.stateCache[solution.stateCache.length - 1];
  const generalIdx = generalCoord.y * board.size.width + generalCoord.x;
  console.log(`  General army at tick ${totalTicks}: ${finalBoard.units[generalIdx]}`);
}

run();

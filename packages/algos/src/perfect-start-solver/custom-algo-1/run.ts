import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';
import { fromBoardState } from '@/core-next/convert';

import { makeBoard } from '../test-boards';
import { solve } from './solver-wip';

interface CustomAlgoOptions {
  board: string;
  ticks: string;
}

// --- CLI ---

const { opts } = parseTypedCommand(
  createTypedCommand<CustomAlgoOptions>()
    .name('run-sa')
    .description('Run custom-algo-1 (multi-config sweep)')
    .option('--board <names>', 'Board names, comma-separated', 'open-7x7')
    .option('--ticks <n>', 'Number of ticks', '50'),
);

function run() {
  console.group('run custom-algo-1');

  const boards = [makeBoard('open-7x7'), makeBoard('sparse-mtns-7x7')];

  for (let testBoard of boards) {
    const flat = fromBoardState(testBoard.board, 1);
    console.log('testBoard:', testBoard.name);
    solve(flat);
    console.log();
  }

  console.groupEnd();
}

run();

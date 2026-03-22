import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';
import { Board, TileType } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards, makeBoard } from '../../test-boards';
import { genPathsDP } from '../gen-paths';
import { buildPathEntries } from '../path-search';

interface Options {
  board: string;
  maxLen: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<Options>()
    .name('board-info')
    .description('Board stats: dimensions, mountains, path counts per length')
    .option('--board <names>', 'Board names, comma-separated', 'all')
    .option('--max-len <n>', 'Max path length to enumerate', '12'),
);

const maxLen = Number(opts.maxLen);
const boards =
  opts.board === 'all' ? allBoards() : opts.board.split(',').map((n) => makeBoard(n));

for (const testBoard of boards) {
  const board = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );

  const totalTiles = board.width * board.height;
  let mountains = 0;
  for (let i = 0; i < totalTiles; i++) {
    if (board.types[i] === TileType.MOUNTAIN) mountains++;
  }
  const density = ((mountains / totalTiles) * 100).toFixed(0);

  const t0 = performance.now();
  const pathsByLen = genPathsDP(board, generalPos, maxLen + 1);
  const entries = buildPathEntries(pathsByLen);
  const genMs = performance.now() - t0;

  console.log(`=== ${testBoard.name} ===`);
  console.log(
    `  ${board.width}x${board.height} (${totalTiles} tiles), ` +
      `${mountains} mountains (${density}%), ` +
      `general at (${testBoard.generalCoord.x},${testBoard.generalCoord.y})`,
  );
  console.log(`  Path generation: ${genMs.toFixed(0)}ms`);

  let total = 0;
  for (let len = 1; len <= maxLen; len++) {
    const count = entries.get(len)?.length ?? 0;
    total += count;
    if (count > 0) {
      console.log(`    len ${String(len).padStart(2)}: ${count.toLocaleString()}`);
    }
  }
  console.log(`    total: ${total.toLocaleString()}`);
  console.log();
}

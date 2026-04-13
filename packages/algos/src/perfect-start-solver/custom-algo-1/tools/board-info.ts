import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';
import { Board, TileType } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards, makeBoard } from '../../test-boards';
import { genPathsDP } from '../gen-paths';
import { buildPathEntries } from '../path-search';

interface Options {
  board?: string;
  maxLen: number;
  minLen: number;
}

const program = createTypedCommand<Options>()
  .name('board-info')
  .description('Board stats: dimensions, mountains, path counts per length')
  .option('--board <names>', 'Board names, comma-separated')
  .option('--min-len <n>', 'Min path length to enumerate', Number, 1)
  .option('--max-len <n>', 'Max path length to enumerate', Number, 12);

const { opts } = parseTypedCommand(program);

if (!opts.board) {
  program.outputHelp();
  process.exit(0);
}

const { minLen, maxLen } = opts;
const boards = resolveBoards(opts.board);

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
  const total = Array.from(entries)
    .filter(([len]) => len >= minLen && len <= maxLen)
    .reduce((sum, [, paths]) => sum + paths.length, 0);
  console.log(
    `  Total path counts: ${total.toLocaleString()} | Generation time: ${genMs.toFixed(0)}ms`,
  );

  for (let len = minLen; len <= maxLen; len++) {
    const count = entries.get(len)?.length ?? 0;
    if (count > 0) {
      console.log(`    len ${String(len).padStart(2)}: ${count.toLocaleString()}`);
    }
  }
  console.log();
}

// --- helpers ---

function resolveBoards(names: string) {
  try {
    return names === 'all' ? allBoards() : names.split(',').map((n) => makeBoard(n));
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Unknown board:')) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
}

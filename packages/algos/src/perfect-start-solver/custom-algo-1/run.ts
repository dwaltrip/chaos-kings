import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';
import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards, simpleBoards, realisticBoards } from '../test-boards';
import { solveV3 } from './solver-v3';

interface RunOptions {
  board: string;
  ticks: string;
  maxBursts: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<RunOptions>()
    .name('run-custom-algo')
    .description('Run custom-algo-1 burst-path solver')
    .option(
      '--board <filters>',
      'Board name filters, comma-separated (e.g. "25x25,corner" or "all")',
    )
    .option('--ticks <n>', 'Number of ticks', '50')
    .option('--max-bursts <n>', 'Max number of bursts', ''),
);

if (!opts.board) {
  console.error('--board is required (e.g. --board all, --board corridor-7x7)');
  process.exit(1);
}

const BOARD_GROUP_KEYWORDS: Record<string, () => ReturnType<typeof allBoards>> = {
  all: allBoards,
  simple: simpleBoards,
  realistic: realisticBoards,
};

function resolveBoards(input: string) {
  const group = BOARD_GROUP_KEYWORDS[input];
  if (group) return group();
  const filters = input.split(',').map((f) => f.trim());
  const matched = allBoards().filter((b) => filters.some((f) => b.name.includes(f)));
  return matched;
}

const maxTicks = Number(opts.ticks);
const maxBursts = opts.maxBursts ? Number(opts.maxBursts) : undefined;
const boards = resolveBoards(opts.board);

if (boards.length === 0) {
  console.error(`No boards matched filter: ${opts.board}`);
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

  const result = solveV3(board, generalPos, {
    maxTicks,
    ...(maxBursts !== undefined && { maxBursts }),
  });
  printResult(result.solution, result.entriesChecked, result.elapsedMs, board);
  const st = result.stats;
  console.log(
    `    stats: ${st.searchCalls.toLocaleString()} search calls, ` +
      `${st.candidatesChecked.toLocaleString()} cands checked, ` +
      `${st.feasibilityChecks.toLocaleString()} feas checks, ` +
      `${st.feasibilityPrunes.toLocaleString()} feas prunes, ` +
      `${st.feasibilityEntriesKilled.toLocaleString()} entries killed`,
  );

  console.log();
}

function printResult(
  solution: any,
  checked: number,
  elapsedMs: number,
  board: { width: number },
) {
  if (!solution) {
    console.log(`  No solution. Checked ${checked} entries in ${elapsedMs.toFixed(0)}ms`);
    return;
  }

  const s = solution;
  console.log(
    `  ${s.totalCaptured} captured, ${elapsedMs.toFixed(0)}ms, ${checked} entries`,
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

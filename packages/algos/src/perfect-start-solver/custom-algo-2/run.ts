import { Board, TileType } from '@core-next/flat-board';
import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { loadBoardCtx } from '../utils/board';
import { renderBoard } from '../utils/render-board';
import { allBoards, simpleBoards, realisticBoards } from '../test-boards';
import { formatTable } from '@/utils/format';

import { solve, type SolveResult } from './solve';
import type { Solution } from './assembler';

interface RunOptions {
  board: string;
  maxOverlap: string;
  prefixTopK: string;
  maxCaptures: string;
  minCaptures: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<RunOptions>()
    .name('run-custom-algo-2')
    .description('Run custom-algo-2 prototype solver')
    .option(
      '--board <filters>',
      'Board name filters, comma-separated (e.g. "25x25,corner" or "all")',
    )
    .option('--max-overlap <n>', 'Max total overlap budget', '10')
    .option('--prefix-top-k <n>', 'Top-K prefix sets to keep', '50')
    .option('--max-captures <n>', 'Max capture target', '24')
    .option('--min-captures <n>', 'Min capture target', '16'),
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

const boards = resolveBoards(opts.board);
if (boards.length === 0) {
  console.error(`No boards matched filter: ${opts.board}`);
  process.exit(1);
}

interface BoardRun {
  name: string;
  result: SolveResult;
}

const runs: BoardRun[] = [];

for (const testBoard of boards) {
  const { flatBoard: board, generalPos } = loadBoardCtx(testBoard.name);

  console.log(`## ${testBoard.name}`);

  const result = solve(board, generalPos, {
    maxTotalOverlap: Number(opts.maxOverlap),
    prefixTopK: Number(opts.prefixTopK),
    maxCaptures: Number(opts.maxCaptures),
    minCaptures: Number(opts.minCaptures),
  });
  runs.push({ name: testBoard.name, result });

  const { solution, stats } = result;
  if (!solution) {
    console.log(`  No solution found. ${stats.elapsedMs}ms`);
  } else {
    printSolution(board, generalPos, solution);
  }

  console.log(
    `  stats: ${stats.prefixSetsGenerated} prefix sets, ` +
      `${stats.timingEntriesTotal.toLocaleString()} timing entries, ` +
      `${stats.mappingsAttempted.toLocaleString()} mappings, ` +
      `${stats.laneAttemptsTotal.toLocaleString()} lane attempts, ` +
      `${stats.elapsedMs}ms`,
  );
  console.log();
}

// Summary table.
if (runs.length > 1) {
  const headers = ['Board', 'Caps', 'Time', 'Prefix sets', 'Mappings', 'Lane attempts'];
  const sorted = [...runs].sort(
    (a, b) => a.result.stats.elapsedMs - b.result.stats.elapsedMs,
  );
  const rows = sorted.map((r) => {
    const s = r.result.solution;
    const st = r.result.stats;
    return [
      r.name,
      s ? String(s.captures) : '-',
      `${st.elapsedMs}ms`,
      String(st.prefixSetsGenerated),
      st.mappingsAttempted.toLocaleString(),
      st.laneAttemptsTotal.toLocaleString(),
    ];
  });
  console.log('# Summary');
  console.log(formatTable(headers, rows));
}

function printSolution(
  board: Parameters<typeof Board.toXY>[0],
  general: number,
  solution: Solution,
): void {
  const pattern = solution.bursts.map((b) => b.captures).join(', ');
  console.log(
    `  ${solution.captures} captures | pattern: [${pattern}] | ` +
      `last move: t=${solution.endTick}`,
  );

  for (let i = 0; i < solution.bursts.length; i++) {
    const b = solution.bursts[i];
    const pathStr = b.path
      .map((t) => {
        const { x, y } = Board.toXY(board, t);
        return `(${x},${y})`;
      })
      .join('→');
    console.log(
      `  B${i + 1}: ${b.captures} caps, ${b.overlap} ovl, ` +
        `t=${b.startTick}-${b.endTick} | ${pathStr}`,
    );
  }

  // Render the solution on the board.
  const tileOwner = new Map<number, number>();
  const shared = new Set<number>();
  for (let bi = 0; bi < solution.bursts.length; bi++) {
    for (const t of solution.bursts[bi].path) {
      if (tileOwner.has(t)) shared.add(t);
      else tileOwner.set(t, bi);
    }
  }

  const allTiles = new Set<number>();
  for (const b of solution.bursts) {
    for (const t of b.path) allTiles.add(t);
  }
  allTiles.add(general);

  const rendered = renderBoard(board, {
    crop: { kind: 'tiles', tiles: allTiles, padding: 2 },
    tileChar: (idx) => {
      if (idx === general) return 'G';
      if (shared.has(idx)) return '*';
      const bi = tileOwner.get(idx);
      if (bi != null) return String(bi + 1);
      if (board.types[idx] === TileType.MOUNTAIN) return '#';
      return null;
    },
  });
  console.log(rendered);
}

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';
import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { formatTable } from '@/utils/format';
import { allBoards, simpleBoards, realisticBoards, slowSearch } from '../test-boards';
import { solveV3, type SolverResult, type Solution } from './solver-v3';

interface RunOptions {
  board: string;
  ticks: string;
  maxBursts: string;
  profile: boolean;
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
    .option('--max-bursts <n>', 'Max number of bursts', '')
    .option('--profile', 'Profile feasibility checks (no short-circuit)', false),
);

if (!opts.board) {
  console.error('--board is required (e.g. --board all, --board corridor-7x7)');
  process.exit(1);
}

const BOARD_GROUP_KEYWORDS: Record<string, () => ReturnType<typeof allBoards>> = {
  all: allBoards,
  simple: simpleBoards,
  realistic: realisticBoards,
  slowSearch: slowSearch,
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

interface BoardRun {
  name: string;
  result: SolverResult;
}

const runs: BoardRun[] = [];

for (const testBoard of boards) {
  const board = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );

  console.log(`## ${testBoard.name}`);

  const result = solveV3(board, generalPos, {
    maxTicks,
    ...(maxBursts !== undefined && { maxBursts }),
    profile: opts.profile,
  });
  runs.push({ name: testBoard.name, result });

  printResult(result.solution, result.entriesChecked, result.elapsedMs);
  const st = result.stats;
  console.log(
    `  stats: ${st.searchCalls.toLocaleString()} search calls, ` +
      `${st.candidatesChecked.toLocaleString()} cands checked, ` +
      `${st.feasibilityChecks.toLocaleString()} feas checks, ` +
      `${st.feasibilityPrunes.toLocaleString()} feas prunes, ` +
      `${st.feasibilityEntriesKilled.toLocaleString()} entries killed`,
  );
  if (st.feasProfile) {
    const fp = st.feasProfile;
    const total = Object.values(fp).reduce((a, b) => a + b, 0);
    console.log(
      `    feasibility profile (N_P_A → count, total=${total.toLocaleString()}):`,
    );
    for (const [key, count] of Object.entries(fp)) {
      if (count === 0) continue;
      const pct = ((count / total) * 100).toFixed(1);
      console.log(`      ${key}: ${count.toLocaleString()} (${pct}%)`);
    }
  }

  console.log();
}

// Summary table
if (runs.length > 1) {
  const headers = ['Board', 'Caps', 'Time', 'Entries', 'Search', 'Cands', 'Feas prunes'];
  const sorted = [...runs].sort((a, b) => a.result.elapsedMs - b.result.elapsedMs);
  const rows = sorted.map((r) => {
    const s = r.result.solution;
    const st = r.result.stats;
    return [
      r.name,
      s ? String(s.totalCaptured) : '-',
      `${r.result.elapsedMs.toFixed(0)}ms`,
      r.result.entriesChecked.toLocaleString(),
      st.searchCalls.toLocaleString(),
      st.candidatesChecked.toLocaleString(),
      st.feasibilityPrunes.toLocaleString(),
    ];
  });
  console.log('# Summary');
  console.log(formatTable(headers, rows));
}

function printResult(solution: Solution | null, checked: number, elapsedMs: number) {
  if (!solution) {
    console.log(`  No solution. Checked ${checked} entries in ${elapsedMs.toFixed(0)}ms`);
    return;
  }

  const s = solution;
  const lastTick = s.burstInfos[s.burstInfos.length - 1].endTick;
  const pattern = s.pattern.join(', ');
  const totalOverlap = s.overlaps.reduce((a, b) => a + b, 0);
  const overlapStr =
    totalOverlap === 0 ? 'none' : `${s.overlaps.join(', ')} (${totalOverlap} total)`;
  const parts = [
    `${s.totalCaptured} captures`,
    `${elapsedMs.toFixed(0)}ms`,
    `${checked.toLocaleString()} entries`,
    `pattern: ${pattern}`,
    `overlap: ${overlapStr}`,
    `last move: t=${lastTick}`,
  ];
  console.log(`  ${parts.join(' | ')}`);
}

// Deep phase analysis — enhanced thread 1/10 instrumentation.
// Multi-run median timing. Expanded board suite.
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.22-3-deep-phase-analysis.ts

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { formatTable } from '../../format';
import {
  solveV3,
  type SolverResult,
  type TargetProfile,
  type FeasibilityProfile,
  type FeasProfileKey,
} from '../../custom-algo-1/solver-v3';
import {
  allBoards,
  realisticBoards,
  slowSearch,
  type TestBoard,
} from '../../test-boards';

// ── Config ──

const RUNS = 3; // runs per board, report median

// ── Board selection ──

// Slow small boards (>100ms single run)
const SLOW_SMALL_BOARDS = [
  'corner-7x7',
  'open-9x9',
  'corner-9x9',
  'edge-pocket-9x9',
  'edge-pocket-2-9x9',
  'open-11x11',
  'pocket-11x11',
  'floating-corner-11x11',
  'open-13x13',
  'corner-13x13',
  'scattered-pockets-13x13',
];

function getBoards(): TestBoard[] {
  const all = allBoards();

  const names = [
    // ...SLOW_SMALL_BOARDS,
    // ...realisticBoards().map((b) => b.name),
    ...slowSearch().map((b) => b.name),
  ];

  return names.map((name) => {
    const b = all.find((b) => b.name === name);
    if (!b) throw new Error(`Board not found: ${name}`);
    return b;
  });
}

// ── Multi-run helpers ──

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

interface RunResult {
  result: SolverResult; // profile data from median run
  medianMs: number;
  allMs: number[];
}

function runBoard(testBoard: TestBoard, runs: number): RunResult {
  const board = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );

  const results: SolverResult[] = [];
  for (let i = 0; i < runs; i++) {
    results.push(solveV3(board, generalPos, { profile: true }));
  }

  const allMs = results.map((r) => r.elapsedMs);
  const med = median(allMs);

  // Pick the run closest to median for profile data
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < results.length; i++) {
    const dist = Math.abs(results[i].elapsedMs - med);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return { result: results[bestIdx], medianMs: med, allMs };
}

// ── Formatting helpers ──

function ms(n: number): string {
  if (n < 0.1) return '<0.1ms';
  return n.toFixed(1) + 'ms';
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function safePct(num: number, den: number): string {
  return den > 0 ? pct(num / den) : '-';
}

function num(n: number): string {
  return n.toLocaleString();
}

function wasteRatio(checked: number, passed: number): number {
  return checked === 0 ? 0 : 1 - passed / checked;
}

// Short board name for compact tables
function shortName(name: string): string {
  return name
    .replace('3.21-real-board-', '')
    .replace(/^3[\.-]22[\.-]/, '')
    .replace('corner-', 'c');
}

// ── Per-board detailed output ──

function printBoardDetail(name: string, run: RunResult) {
  const { result, medianMs, allMs } = run;
  const pd = result.profileData!;
  const st = result.stats;

  console.log(`\n## ${name}`);
  console.log(
    `  Median: ${ms(medianMs)} | Runs: [${allMs.map((t) => ms(t)).join(', ')}]`,
  );
  console.log(
    `  PathGen: ${ms(pd.pathGenMs)} | ` +
      `Solution: ${result.solution ? result.solution.totalCaptured + ' captures' : 'none'}`,
  );
  console.log(
    `  Stats: ${num(st.candidatesChecked)} cands checked, ` +
      `${num(st.candidatesPassed)} passed (${pct(wasteRatio(st.candidatesChecked, st.candidatesPassed))} waste) | ` +
      `${num(st.searchCalls)} search calls`,
  );

  const targets = pd.targets;
  if (targets.length === 0) {
    console.log('  No targets attempted.\n');
    return;
  }

  // Per-target overview
  console.log('\n  ### Per-target overview');
  const headers1 = [
    'Caps',
    'TimTbl',
    'Search',
    'Groups',
    'TimEntries',
    'B1 ent',
    'SearchCalls',
    'Cands chk',
    'Cands pass',
  ];
  const rows1 = targets.map((t) => [
    String(t.captures),
    ms(t.timingTableMs),
    ms(t.searchMs),
    String(t.groupCount),
    num(t.totalTimingEntries),
    num(t.burst1Entries),
    num(t.searchCalls),
    num(t.candidatesChecked),
    num(t.candidatesPassed),
  ]);
  console.log(formatTable(headers1, rows1).replace(/^/gm, '  '));

  // Derived metrics
  console.log('\n  ### Derived metrics');
  const headers2 = [
    'Caps',
    'us/B1call',
    'us/searchCall',
    'entries/group',
    'candsChk/searchCall',
  ];
  const rows2 = targets.map((t) => {
    const usPerB1 =
      t.burst1Entries > 0 ? ((t.searchMs * 1000) / t.burst1Entries).toFixed(0) : '-';
    const usPerSearch =
      t.searchCalls > 0 ? ((t.searchMs * 1000) / t.searchCalls).toFixed(1) : '-';
    const entriesPerGroup =
      t.groupCount > 0 ? (t.totalTimingEntries / t.groupCount).toFixed(1) : '-';
    const candsPerSearch =
      t.searchCalls > 0 ? (t.candidatesChecked / t.searchCalls).toFixed(1) : '-';
    return [String(t.captures), usPerB1, usPerSearch, entriesPerGroup, candsPerSearch];
  });
  console.log(formatTable(headers2, rows2).replace(/^/gm, '  '));

  // Feasibility breakdown
  const hasFeasData = targets.some((t) => t.feasProfile !== null);
  if (hasFeasData) {
    console.log('\n  ### Feasibility breakdown (N=neighbors, P=perBurst, A=aggregate)');
    const feasHeaders = ['Caps', 'Checked', 'N kill', 'P kill', 'A kill', 'Pass'];
    const feasRows = targets.map((t) => {
      const fp = t.feasProfile;
      if (!fp) return [String(t.captures), '-', '-', '-', '-', '-'];

      const nKill = fp['0_0_0'] + fp['0_0_1'] + fp['0_1_0'] + fp['0_1_1'];
      const pKill = fp['1_0_0'] + fp['1_0_1'];
      const aKill = fp['1_1_0'];
      const pass = fp['1_1_1'];
      const total = nKill + pKill + aKill + pass;

      return [
        String(t.captures),
        num(total),
        `${safePct(nKill, total)}`,
        `${safePct(pKill, total)}`,
        `${safePct(aKill, total)}`,
        `${safePct(pass, total)}`,
      ];
    });
    console.log(formatTable(feasHeaders, feasRows).replace(/^/gm, '  '));
  }

  // Infeasible target summary
  const solvedAt = result.solution
    ? targets.find(
        (t) => t.candidatesPassed > 0 || t.captures === result.solution!.totalCaptured,
      )
    : null;
  if (solvedAt && targets.length > 1) {
    const infeasible = targets.filter((t) => t.captures > solvedAt.captures);
    const infeasibleMs = infeasible.reduce((s, t) => s + t.timingTableMs + t.searchMs, 0);
    if (infeasible.length > 0) {
      console.log(
        `\n  Infeasible targets (>${solvedAt.captures}): ` +
          `${infeasible.length} targets, ${ms(infeasibleMs)} wasted`,
      );
    }
  }
}

// ── Cross-board summaries ──

function printSummary(results: { name: string; run: RunResult }[]) {
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('# Cross-board Summary');
  console.log('═══════════════════════════════════════════════════════\n');

  // Overview
  console.log('## Overview\n');
  const sumHeaders = [
    'Board',
    'Size',
    'Caps',
    'Median',
    'PathGen',
    'Search',
    'Tgts',
    'SearchCalls',
    'Cands chk',
    'Waste',
  ];
  const sumRows = results.map(({ name, run }) => {
    const { result, medianMs } = run;
    const pd = result.profileData!;
    const st = result.stats;
    const searchMs = pd.targets.reduce((s, t) => s + t.timingTableMs + t.searchMs, 0);
    // Extract board size from name
    const sizeMatch = name.match(/(\d+x\d+)/);
    const size = sizeMatch ? sizeMatch[1] : '?';
    return [
      shortName(name),
      size,
      result.solution ? String(result.solution.totalCaptured) : '-',
      ms(medianMs),
      ms(pd.pathGenMs),
      ms(searchMs),
      String(pd.targets.length),
      num(st.searchCalls),
      num(st.candidatesChecked),
      pct(wasteRatio(st.candidatesChecked, st.candidatesPassed)),
    ];
  });
  console.log(formatTable(sumHeaders, sumRows));

  // Time budget
  console.log('\n## Time budget\n');
  const budgetHeaders = [
    'Board',
    'Median',
    'PathGen%',
    'TimTbl%',
    'Search%',
    'InfeasTgt%',
    'SolveTgt%',
  ];
  const budgetRows = results.map(({ name, run }) => {
    const { result, medianMs } = run;
    const pd = result.profileData!;
    const total = result.elapsedMs;
    const timTblMs = pd.targets.reduce((s, t) => s + t.timingTableMs, 0);
    const searchMs = pd.targets.reduce((s, t) => s + t.searchMs, 0);
    const solvedAt = result.solution?.totalCaptured ?? 0;
    const infeasMs = pd.targets
      .filter((t) => t.captures > solvedAt)
      .reduce((s, t) => s + t.timingTableMs + t.searchMs, 0);
    const solveMs = pd.targets
      .filter((t) => t.captures <= solvedAt)
      .reduce((s, t) => s + t.timingTableMs + t.searchMs, 0);

    return [
      shortName(name),
      ms(medianMs),
      safePct(pd.pathGenMs, total),
      safePct(timTblMs, total),
      safePct(searchMs, total),
      safePct(infeasMs, total),
      safePct(solveMs, total),
    ];
  });
  console.log(formatTable(budgetHeaders, budgetRows));

  // Feasibility kill breakdown
  console.log('\n## Feasibility kill breakdown (all targets combined)\n');
  const fkHeaders = ['Board', 'Total checked', 'N kill%', 'P kill%', 'A kill%', 'Pass%'];
  const fkRows = results.map(({ name, run }) => {
    const fp = run.result.stats.feasProfile;
    if (!fp) return [shortName(name), '-', '-', '-', '-', '-'];

    const nKill = fp['0_0_0'] + fp['0_0_1'] + fp['0_1_0'] + fp['0_1_1'];
    const pKill = fp['1_0_0'] + fp['1_0_1'];
    const aKill = fp['1_1_0'];
    const pass = fp['1_1_1'];
    const total = nKill + pKill + aKill + pass;

    return [
      shortName(name),
      num(total),
      safePct(nKill, total),
      safePct(pKill, total),
      safePct(aKill, total),
      safePct(pass, total),
    ];
  });
  console.log(formatTable(fkHeaders, fkRows));

  // Per-call costs
  console.log('\n## Per-call costs\n');
  const pcHeaders = ['Board', 'us/searchCall', 'Cands/call', 'FeasEntries/call'];
  const pcRows = results.map(({ name, run }) => {
    const st = run.result.stats;
    const pd = run.result.profileData!;
    const searchMs = pd.targets.reduce((s, t) => s + t.searchMs, 0);
    const totalFeasChecks = pd.targets.reduce((s, t) => s + t.feasibilityChecks, 0);

    return [
      shortName(name),
      st.searchCalls > 0 ? ((searchMs * 1000) / st.searchCalls).toFixed(1) : '-',
      st.searchCalls > 0 ? (st.candidatesChecked / st.searchCalls).toFixed(1) : '-',
      st.searchCalls > 0 ? (totalFeasChecks / st.searchCalls).toFixed(1) : '-',
    ];
  });
  console.log(formatTable(pcHeaders, pcRows));

  // Timing entry explosion table
  console.log('\n## Timing entry counts by capture target\n');
  console.log('(Shows how entries/group scales with decreasing capture target)\n');
  // Collect all unique capture targets seen
  const allTargets = new Set<number>();
  for (const { run } of results) {
    for (const t of run.result.profileData!.targets) {
      allTargets.add(t.captures);
    }
  }
  const capLevels = [...allTargets].sort((a, b) => b - a);
  const teHeaders = ['Board', ...capLevels.map((c) => `cap=${c}`)];
  const teRows = results.map(({ name, run }) => {
    const pd = run.result.profileData!;
    return [
      shortName(name),
      ...capLevels.map((cap) => {
        const t = pd.targets.find((t) => t.captures === cap);
        if (!t) return '-';
        return `${num(t.totalTimingEntries)} (${(t.totalTimingEntries / t.groupCount).toFixed(0)}/grp)`;
      }),
    ];
  });
  console.log(formatTable(teHeaders, teRows));
}

// ── Main ──

function main() {
  const boards = getBoards();
  console.log(`# Deep Phase Analysis — ${boards.length} boards, ${RUNS} runs each`);

  const results: { name: string; run: RunResult }[] = [];

  for (const testBoard of boards) {
    process.stderr.write(`Running ${testBoard.name}...`);
    const run = runBoard(testBoard, RUNS);
    results.push({ name: testBoard.name, run });
    process.stderr.write(` ${ms(run.medianMs)}\n`);
    printBoardDetail(testBoard.name, run);
  }

  printSummary(results);
}

main();

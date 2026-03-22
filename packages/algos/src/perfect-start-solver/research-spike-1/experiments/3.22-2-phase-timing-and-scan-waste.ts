// Thread 1 (phase timing breakdown) + Thread 10 (inner-loop scan waste measurement)
// Combined instrumentation pass — no algorithmic changes, pure measurement.
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.22-2-phase-timing-and-scan-waste.ts

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { formatTable } from '../../format';
import {
  solveV3,
  type SolverResult,
  type TargetProfile,
} from '../../custom-algo-1/solver-v3';
import { allBoards, realisticBoards, type TestBoard } from '../../test-boards';

// ── Board selection ──

const SELECTED_BOARDS = [
  // Corner boards (synthetic hard cases)
  'corner-7x7',
  'corner-9x9',
  'corner-13x13',
  // Realistic boards
  ...realisticBoards().map((b) => b.name),
];

function getBoards(): TestBoard[] {
  const all = allBoards();
  return SELECTED_BOARDS.map((name) => {
    const b = all.find((b) => b.name === name);
    if (!b) throw new Error(`Board not found: ${name}`);
    return b;
  });
}

// ── Formatting helpers ──

function ms(n: number): string {
  if (n < 0.1) return '<0.1ms';
  return n.toFixed(1) + 'ms';
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function wasteRatio(checked: number, passed: number): number {
  return checked === 0 ? 0 : 1 - passed / checked;
}

// ── Per-board output ──

function printBoardDetail(name: string, result: SolverResult) {
  const pd = result.profileData!;
  const st = result.stats;

  console.log(`## ${name}`);
  console.log(
    `  Total: ${ms(result.elapsedMs)} | Path gen: ${ms(pd.pathGenMs)} | Solution: ${result.solution ? result.solution.totalCaptured + ' captures' : 'none'}`,
  );
  console.log(
    `  Candidates: ${st.candidatesChecked.toLocaleString()} checked, ${st.candidatesPassed.toLocaleString()} passed, ${pct(wasteRatio(st.candidatesChecked, st.candidatesPassed))} waste`,
  );
  console.log();

  // Per-target breakdown
  const targets = pd.targets;
  if (targets.length === 0) {
    console.log('  No targets attempted.\n');
    return;
  }

  const targetHeaders = [
    'Caps',
    'TimTbl',
    'Search',
    'Groups',
    'B1 ent',
    'Cands chk',
    'Cands pass',
    'Waste',
  ];
  const targetRows = targets.map((t) => [
    String(t.captures),
    ms(t.timingTableMs),
    ms(t.searchMs),
    String(t.groupCount),
    t.burst1Entries.toLocaleString(),
    t.candidatesChecked.toLocaleString(),
    t.candidatesPassed.toLocaleString(),
    pct(wasteRatio(t.candidatesChecked, t.candidatesPassed)),
  ]);
  console.log('  Per capture target:');
  console.log(formatTable(targetHeaders, targetRows).replace(/^/gm, '  '));

  // Highlight infeasible target waste
  const solvedAt = result.solution
    ? targets.find(
        (t) => t.candidatesPassed > 0 || t.captures === result.solution!.totalCaptured,
      )
    : null;
  if (solvedAt && targets.length > 1) {
    const infeasibleTargets = targets.filter((t) => t.captures > solvedAt.captures);
    const infeasibleMs = infeasibleTargets.reduce(
      (s, t) => s + t.timingTableMs + t.searchMs,
      0,
    );
    const infeasibleCands = infeasibleTargets.reduce(
      (s, t) => s + t.candidatesChecked,
      0,
    );
    if (infeasibleTargets.length > 0) {
      console.log(
        `\n  Infeasible targets (>${solvedAt.captures}): ${infeasibleTargets.length} targets, ${ms(infeasibleMs)} wasted, ${infeasibleCands.toLocaleString()} candidates scanned`,
      );
    }
  }

  console.log();
}

// ── Main ──

function main() {
  const boards = getBoards();
  console.log(`# Phase Timing & Scan Waste — ${boards.length} boards\n`);

  interface BoardResult {
    name: string;
    result: SolverResult;
  }
  const results: BoardResult[] = [];

  for (const testBoard of boards) {
    const board = fromBoardState(testBoard.board, 1);
    const generalPos = Board.toIndex(
      board,
      testBoard.generalCoord.x,
      testBoard.generalCoord.y,
    );

    const result = solveV3(board, generalPos, { profile: true });
    results.push({ name: testBoard.name, result });
    printBoardDetail(testBoard.name, result);
  }

  // Summary table
  console.log('\n# Summary\n');

  const sumHeaders = [
    'Board',
    'Caps',
    'Total',
    'PathGen',
    'Search',
    'Targets',
    'Cands chk',
    'Cands pass',
    'Waste',
  ];
  const sumRows = results.map(({ name, result }) => {
    const pd = result.profileData!;
    const st = result.stats;
    const searchMs = pd.targets.reduce((s, t) => s + t.timingTableMs + t.searchMs, 0);
    return [
      name,
      result.solution ? String(result.solution.totalCaptured) : '-',
      ms(result.elapsedMs),
      ms(pd.pathGenMs),
      ms(searchMs),
      String(pd.targets.length),
      st.candidatesChecked.toLocaleString(),
      st.candidatesPassed.toLocaleString(),
      pct(wasteRatio(st.candidatesChecked, st.candidatesPassed)),
    ];
  });
  console.log(formatTable(sumHeaders, sumRows));
}

main();

// Profile SA to see where time is spent.
// Usage: npx tsx src/perfect-start-solver/sim-anneal/tmp-scripts/profile-sa.ts

import { makeBoard } from '../../test-boards';

import { runSA } from '../sim-anneal';
import type { SAProfileData } from '../types';

function fmtMs(ms: number): string {
  return `${ms.toFixed(0)}ms`;
}

function fmtPct(ms: number, total: number): string {
  return `${((ms / total) * 100).toFixed(1)}%`;
}

function printProfile(label: string, p: SAProfileData) {
  console.log(`${label}:`);
  console.log(`  total:        ${fmtMs(p.totalMs)}`);
  console.log(
    `  cloneBoard:   ${fmtMs(p.cloneBoardMs).padEnd(8)} ${fmtPct(p.cloneBoardMs, p.totalMs)}`,
  );
  console.log(
    `  processStep:  ${fmtMs(p.processStepMs).padEnd(8)} ${fmtPct(p.processStepMs, p.totalMs)}`,
  );
  console.log(
    `  genMoves:     ${fmtMs(p.genMovesMs).padEnd(8)} ${fmtPct(p.genMovesMs, p.totalMs)}`,
  );
  console.log(
    `  arrayBuild:   ${fmtMs(p.arrayBuildMs).padEnd(8)} ${fmtPct(p.arrayBuildMs, p.totalMs)}`,
  );
  console.log(
    `  acceptance:   ${fmtMs(p.acceptanceMs).padEnd(8)} ${fmtPct(p.acceptanceMs, p.totalMs)}`,
  );
  const accounted =
    p.cloneBoardMs + p.processStepMs + p.genMovesMs + p.arrayBuildMs + p.acceptanceMs;
  console.log(
    `  unaccounted:  ${fmtMs(p.totalMs - accounted).padEnd(8)} ${fmtPct(p.totalMs - accounted, p.totalMs)}`,
  );
}

const { board } = makeBoard('open-7x7');

for (const iterations of [25000, 100000]) {
  const result = runSA(board, 50, { iterations, t0: 3.0, epsilon: 0.001, profile: true });
  console.log();
  printProfile(
    `${iterations.toLocaleString()} iters (score=${result.bestScore})`,
    result.profile!,
  );
}

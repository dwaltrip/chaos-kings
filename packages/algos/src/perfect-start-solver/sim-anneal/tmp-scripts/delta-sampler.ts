// Sample random neighbors at various solution quality levels and report delta distributions.
// Useful for calibrating T0 and understanding how the search landscape changes as score improves.
//
// Usage: npx tsx src/perfect-start-solver/sim-anneal/tmp-scripts/delta-sampler.ts [options]

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { makeBoard } from '../../test-boards';

import { runSA, buildSolution, generateNeighbor } from '../sim-anneal';
import type { SASolution } from '../types';

interface Options {
  board: string;
  samples: string;
  runs: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<Options>()
    .name('delta-sampler')
    .description('Sample neighbor deltas at various solution quality levels')
    .option('--board <name>', 'Board name', 'open-7x7')
    .option('--samples <n>', 'Neighbors to sample per score level', '300')
    .option('--runs <n>', 'SA runs to collect solutions from', '6'),
);

const boardName = opts.board;
const samplesPerLevel = Number(opts.samples);
const numRuns = Number(opts.runs);
const TOTAL_TICKS = 50;

const SCORE_BUCKETS = [
  { label: 'low (1-8)', min: 1, max: 8 },
  { label: 'mid (9-16)', min: 9, max: 16 },
  { label: 'high (17-21)', min: 17, max: 21 },
  { label: 'near-opt (22-25)', min: 22, max: 25 },
];

// --- Sampling ---

interface SampleResult {
  deltas: number[];
  deltasPerTick: Map<number, number[]>;
}

function sampleNeighbors(solution: SASolution, count: number): SampleResult {
  const deltas: number[] = [];
  const deltasPerTick: Map<number, number[]> = new Map();

  for (let i = 0; i < count; i++) {
    const neighbor = generateNeighbor(solution);
    const delta = neighbor.score - solution.score;
    deltas.push(delta);

    for (let t = 0; t < solution.moves.length; t++) {
      const a = solution.moves[t];
      const b = neighbor.moves[t];
      if (a !== b && (a === null || b === null || a.src !== b.src || a.dir !== b.dir)) {
        if (!deltasPerTick.has(t)) deltasPerTick.set(t, []);
        deltasPerTick.get(t)!.push(delta);
        break;
      }
    }
  }

  return { deltas, deltasPerTick };
}

// --- Reporting ---

function printDeltaDistribution(deltas: number[]) {
  const sorted = [...deltas].sort((a, b) => a - b);
  const buckets = new Map<number, number>();
  for (const d of sorted) {
    buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }

  const sortedBuckets = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  for (const [delta, count] of sortedBuckets) {
    const bar = '#'.repeat(Math.ceil(count / 2));
    console.log(`    ${String(delta).padStart(4)}: ${String(count).padStart(4)}  ${bar}`);
  }
}

function printSummaryStats(deltas: number[]) {
  const neg = deltas.filter((d) => d < 0);
  const zero = deltas.filter((d) => d === 0);
  const pos = deltas.filter((d) => d > 0);
  const total = deltas.length;

  console.log(
    `  neg: ${neg.length} (${pct(neg.length, total)}%)  ` +
      `zero: ${zero.length} (${pct(zero.length, total)}%)  ` +
      `pos: ${pos.length} (${pct(pos.length, total)}%)`,
  );

  if (neg.length > 0) {
    const avgNeg = neg.reduce((a, b) => a + b, 0) / neg.length;
    const sorted = [...neg].sort((a, b) => a - b);
    console.log(
      `  neg avg: ${avgNeg.toFixed(2)}, median: ${sorted[Math.floor(sorted.length / 2)]}, min: ${sorted[0]}`,
    );
  }
}

function printAcceptanceTable(deltas: number[]) {
  const neg = deltas.filter((d) => d < 0);
  if (neg.length === 0) return;

  console.log('  Accept probs for negative deltas:');
  for (const t0 of [1.0, 2.0, 3.0, 5.0]) {
    const avgProb = neg.reduce((sum, d) => sum + Math.exp(d / t0), 0) / neg.length;
    const gt50 = neg.filter((d) => Math.exp(d / t0) > 0.5).length;
    console.log(
      `    T0=${t0}: avg=${(avgProb * 100).toFixed(1)}%, >50%=${pct(gt50, neg.length)}%`,
    );
  }
}

function printTickBreakdown(deltasPerTick: Map<number, number[]>) {
  const regions = [
    { name: ' 0-9 ', lo: 0, hi: 10 },
    { name: '10-19', lo: 10, hi: 20 },
    { name: '20-29', lo: 20, hi: 30 },
    { name: '30-39', lo: 30, hi: 40 },
    { name: '40-49', lo: 40, hi: 50 },
  ];
  console.log('  By tick region:');
  for (const { name, lo, hi } of regions) {
    const rd: number[] = [];
    for (let t = lo; t < hi; t++) {
      const td = deltasPerTick.get(t);
      if (td) rd.push(...td);
    }
    if (rd.length > 0) {
      const avg = rd.reduce((a, b) => a + b, 0) / rd.length;
      console.log(
        `    ${name}: avg=${avg.toFixed(2)}, n=${rd.length}, range=[${Math.min(...rd)}, ${Math.max(...rd)}]`,
      );
    }
  }
}

function pct(n: number, total: number): string {
  return ((n / total) * 100).toFixed(1);
}

// --- Main ---

function run() {
  const { board } = makeBoard(boardName);

  // Collect solutions at various quality levels.
  // Use a range of iteration counts + cold temperature for low-score solutions,
  // since SA climbs fast and even 1000 iters with normal T0 reaches 20+.
  console.log(`Collecting solutions across quality levels...`);
  const runConfigs = [
    { iters: 10, t0: 0.01, label: 'tiny-cold' },
    { iters: 50, t0: 0.01, label: 'tiny-cold' },
    { iters: 100, t0: 0.5, label: 'short-cool' },
    { iters: 200, t0: 0.5, label: 'short-cool' },
    { iters: 1000, t0: 3.0, label: 'short' },
    { iters: 5000, t0: 3.0, label: 'medium' },
    { iters: 50000, t0: 3.0, label: 'long' },
    { iters: 200000, t0: 3.0, label: 'long' },
    { iters: 500000, t0: 3.0, label: 'very-long' },
    { iters: 500000, t0: 3.0, label: 'very-long' },
  ];
  const solutionsByBucket: Map<string, SASolution[]> = new Map();

  for (let i = 0; i < runConfigs.length; i++) {
    const { iters, t0 } = runConfigs[i];
    const result = runSA(board, TOTAL_TICKS, { iterations: iters, t0, epsilon: 0.001 });
    const solution = buildSolution(board, result.bestMoves, TOTAL_TICKS);
    console.log(
      `  run ${i + 1}: ${iters.toLocaleString()} iters (T0=${t0}) → score ${solution.score}`,
    );

    for (const bucket of SCORE_BUCKETS) {
      if (solution.score >= bucket.min && solution.score <= bucket.max) {
        if (!solutionsByBucket.has(bucket.label)) solutionsByBucket.set(bucket.label, []);
        solutionsByBucket.get(bucket.label)!.push(solution);
      }
    }
  }

  // Sample and report for each score level
  for (const bucket of SCORE_BUCKETS) {
    const solutions = solutionsByBucket.get(bucket.label);
    if (!solutions || solutions.length === 0) continue;

    console.log();
    console.log(
      `=== ${bucket.label} (${solutions.length} solutions, scores: [${solutions.map((s) => s.score).join(', ')}]) ===`,
    );

    const allDeltas: number[] = [];
    const allDeltasPerTick: Map<number, number[]> = new Map();

    const perSolution = Math.ceil(samplesPerLevel / solutions.length);
    for (const sol of solutions) {
      const { deltas, deltasPerTick } = sampleNeighbors(sol, perSolution);
      allDeltas.push(...deltas);
      for (const [t, ds] of deltasPerTick) {
        if (!allDeltasPerTick.has(t)) allDeltasPerTick.set(t, []);
        allDeltasPerTick.get(t)!.push(...ds);
      }
    }

    printDeltaDistribution(allDeltas);
    console.log();
    printSummaryStats(allDeltas);
    printAcceptanceTable(allDeltas);
    printTickBreakdown(allDeltasPerTick);
  }
}

run();

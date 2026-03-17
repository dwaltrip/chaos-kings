// Sample random neighbors of a good SA solution and report the delta distribution.
// Useful for calibrating T0 and understanding the search landscape.
//
// Usage: npx tsx src/perfect-start-solver/sim-anneal/tmp-scripts/delta-sampler.ts [options]

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { makeBoard } from '../../test-boards';

import { runSA, generateNeighbor } from '../sim-anneal';
import type { SASolution } from '../types';

interface Options {
  board: string;
  samples: string;
  iterations: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<Options>()
    .name('delta-sampler')
    .description('Sample neighbor deltas around a good SA solution')
    .option('--board <name>', 'Board name', 'open-7x7')
    .option('--samples <n>', 'Number of neighbors to sample', '500')
    .option('--iterations <n>', 'SA iterations to find base solution', '500000'),
);

const boardName = opts.board;
const numSamples = Number(opts.samples);
const iterations = Number(opts.iterations);

function run() {
  const { board } = makeBoard(boardName);

  // First, find a good solution via SA
  console.log(`Finding base solution (${iterations.toLocaleString()} iterations)...`);
  const result = runSA(board, 50, { iterations, t0: 3.0, epsilon: 0.001 });
  console.log(`Base score: ${result.bestScore}`);
  console.log();

  // Reconstruct a full SASolution from the SA result so we can sample neighbors.
  // runSA only returns bestMoves, so we need to re-simulate to get the state cache.
  const { createInitialSolution, simulateForward } = require('../sim-anneal');

  // Simpler: just run SA with the result and build the solution manually
  // Actually, we can import createInitialSolution and patch its moves.
  // But the cleanest way is to expose a helper. For now, let's just run SA
  // and sample neighbors from the *current* solution at the end of the run.
  // We need to refactor slightly... or just re-run SA and grab the solution.

  // For now: run a short SA to get a good SASolution object we can sample from.
  // This is a tmp-script, pragmatism > elegance.
  const baseSolution = buildSolution(board, result.bestMoves);

  console.log(`Sampling ${numSamples} neighbors...`);
  const deltas: number[] = [];
  const deltasPerTick: Map<number, number[]> = new Map();

  for (let i = 0; i < numSamples; i++) {
    const neighbor = generateNeighbor(baseSolution);
    const delta = neighbor.score - baseSolution.score;
    deltas.push(delta);

    // Figure out which tick changed
    for (let t = 0; t < 50; t++) {
      const a = baseSolution.moves[t];
      const b = neighbor.moves[t];
      if (a !== b && (a === null || b === null || a.src !== b.src || a.dir !== b.dir)) {
        if (!deltasPerTick.has(t)) deltasPerTick.set(t, []);
        deltasPerTick.get(t)!.push(delta);
        break;
      }
    }
  }

  // Overall distribution
  deltas.sort((a, b) => a - b);
  const buckets = new Map<number, number>();
  for (const d of deltas) {
    buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }

  console.log();
  console.log('Delta distribution:');
  const sortedBuckets = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  for (const [delta, count] of sortedBuckets) {
    const bar = '#'.repeat(Math.ceil(count / 2));
    console.log(`  ${String(delta).padStart(4)}: ${String(count).padStart(4)}  ${bar}`);
  }

  // Summary stats
  const neg = deltas.filter((d) => d < 0);
  const zero = deltas.filter((d) => d === 0);
  const pos = deltas.filter((d) => d > 0);

  console.log();
  console.log('Summary:');
  console.log(
    `  Negative: ${neg.length} (${((neg.length / deltas.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Zero:     ${zero.length} (${((zero.length / deltas.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Positive: ${pos.length} (${((pos.length / deltas.length) * 100).toFixed(1)}%)`,
  );

  if (neg.length > 0) {
    const avgNeg = neg.reduce((a, b) => a + b, 0) / neg.length;
    console.log(`  Avg negative delta: ${avgNeg.toFixed(2)}`);
    console.log(`  Min delta: ${neg[0]}`);
    console.log(`  Median negative delta: ${neg[Math.floor(neg.length / 2)]}`);
  }

  // Acceptance probability at various temperatures
  if (neg.length > 0) {
    console.log();
    console.log('Acceptance probabilities for negative deltas at various T0:');
    for (const t0 of [1.0, 2.0, 3.0, 5.0, 8.0]) {
      const accepted = neg.filter((d) => Math.exp(d / t0) > 0.5).length;
      const pctAccepted = ((accepted / neg.length) * 100).toFixed(1);
      const avgProb = neg.reduce((sum, d) => sum + Math.exp(d / t0), 0) / neg.length;
      console.log(
        `  T0=${t0}: avg accept prob ${(avgProb * 100).toFixed(1)}%, ` +
          `${pctAccepted}% have >50% accept chance`,
      );
    }
  }

  // Per-tick breakdown (early vs late)
  console.log();
  console.log('Avg delta by tick region:');
  const regions = [
    { name: 'ticks 0-9', range: [0, 10] as const },
    { name: 'ticks 10-19', range: [10, 20] as const },
    { name: 'ticks 20-29', range: [20, 30] as const },
    { name: 'ticks 30-39', range: [30, 40] as const },
    { name: 'ticks 40-49', range: [40, 50] as const },
  ];
  for (const { name, range } of regions) {
    const regionDeltas: number[] = [];
    for (let t = range[0]; t < range[1]; t++) {
      const td = deltasPerTick.get(t);
      if (td) regionDeltas.push(...td);
    }
    if (regionDeltas.length > 0) {
      const avg = regionDeltas.reduce((a, b) => a + b, 0) / regionDeltas.length;
      console.log(
        `  ${name}: avg=${avg.toFixed(2)}, n=${regionDeltas.length}, ` +
          `min=${Math.min(...regionDeltas)}, max=${Math.max(...regionDeltas)}`,
      );
    } else {
      console.log(`  ${name}: no samples`);
    }
  }
}

// Rebuild a full SASolution from a move sequence by re-simulating
function buildSolution(boardState: any, moves: any[]): SASolution {
  const { DEFAULT_TIMING } = require('@core/game-timing-config');
  const { fromBoardState } = require('@/core-next/convert');
  const { cloneBoard } = require('@/core-next/flat-board');
  const { processStep } = require('@/core-next/process-step');

  const initialBoard = fromBoardState(structuredClone(boardState), 1);
  const stateCache = [initialBoard];
  let board = initialBoard;

  for (let i = 0; i < 50; i++) {
    board = cloneBoard(board);
    const move = moves[i] ?? null;
    processStep(board, move, 0, i + 1, DEFAULT_TIMING);
    stateCache.push(board);
  }

  const score = board.stats.landCounts[0];
  return { moves: [...moves], score, stateCache };
}

run();

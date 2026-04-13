import { type FlatBoard } from '@core-next/flat-board';

import { type TipScores } from './prototyping/tip-scorer';
import {
  generatePrefixSets,
  type PrefixSet,
  type ScoreAggregator,
} from './prefix-gen/generate';

// Generate a merged pool of top-K prefix sets across multiple burst-count
// and path-length configs. Deduplicates by unionMask across configs, keeping
// the highest-scoring variant for each unique union.

interface PrefixPoolOptions {
  board: FlatBoard;
  general: number;
  maxTotalOverlap: number;
  topK: number;
  // Pre-computed tip scores (avoids redundant recomputation).
  tipScores: TipScores;
  // Burst count range to try. Default [3, 4, 5, 6].
  burstCounts?: number[];
  // Path length range to try. Default [1, 2, 3, 4, 5].
  pathLengths?: number[];
  maxIterationsPerConfig?: number;
  aggregator?: ScoreAggregator;
}

interface PrefixPoolResult {
  sets: PrefixSet[];
  configsRun: number;
  totalIterations: number;
  elapsedMs: number;
}

function generatePrefixPool(options: PrefixPoolOptions): PrefixPoolResult {
  const {
    board,
    general,
    maxTotalOverlap,
    topK,
    tipScores,
    burstCounts = [3, 4, 5, 6],
    pathLengths = [1, 2, 3, 4, 5],
    maxIterationsPerConfig = 200_000,
    aggregator = 'sum',
  } = options;

  const t0 = Date.now();
  // Global dedup by unionMask — same union produces identical downstream
  // behavior regardless of which config generated it.
  const bestByUnion = new Map<string, PrefixSet>();
  let configsRun = 0;
  let totalIterations = 0;

  for (const K of burstCounts) {
    for (const L of pathLengths) {
      const prefixLengths = new Array(K).fill(L);
      configsRun++;

      const result = generatePrefixSets({
        board,
        general,
        prefixLengths,
        maxOverlap: maxTotalOverlap,
        topK,
        maxIterations: maxIterationsPerConfig,
        aggregator,
        tipScores,
      });
      totalIterations += result.iterations;

      for (const set of result.sets) {
        const key = set.unionMask.toString();
        const existing = bestByUnion.get(key);
        if (!existing || set.aggregateScore > existing.aggregateScore) {
          bestByUnion.set(key, set);
        }
      }
    }
  }

  // Sort descending by aggregate score, take top-K.
  const merged = Array.from(bestByUnion.values());
  merged.sort((a, b) => b.aggregateScore - a.aggregateScore);
  const sets = merged.slice(0, topK);

  return {
    sets,
    configsRun,
    totalIterations,
    elapsedMs: Date.now() - t0,
  };
}

export type { PrefixPoolOptions, PrefixPoolResult };
export { generatePrefixPool };

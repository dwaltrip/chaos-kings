import type { FlatBoard } from '@/core-next/flat-board';
import type { FlatMove } from '@/core-next/process-step';

interface SASolution {
  moves: FlatMove[];
  // Cached board state at each tick. Length = ticks + 1 (index 0 = initial state).
  // stateCache[t] is the board state AFTER tick t has been processed.
  // stateCache[0] is the initial board before any ticks.
  stateCache: FlatBoard[];
  score: number;
}

interface SAConfig {
  iterations: number;
  t0: number; // initial temperature
  epsilon: number; // final temperature ratio (finalTemp = t0 * epsilon)
}

interface SAResult {
  bestScore: number;
  bestMoves: FlatMove[];
  scoreProgression: number[]; // best score at each 10% milestone
  totalIterations: number;
  acceptedCount: number;
  runtimeMs: number;
}

export type { SASolution, SAConfig, SAResult };

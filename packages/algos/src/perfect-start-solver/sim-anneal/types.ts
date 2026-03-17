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

export type { SASolution };

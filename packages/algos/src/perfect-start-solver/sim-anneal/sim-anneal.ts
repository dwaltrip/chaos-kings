import type { BoardState, Coord } from '@core/types';
import { DEFAULT_TIMING } from '@core/game-timing-config';
import type { TimingConfig } from '@core/timing/types';

import { cloneBoard } from '@/core-next/flat-board';
import type { FlatBoard } from '@/core-next/flat-board';
import { processStep } from '@/core-next/process-step';
import type { FlatMove } from '@/core-next/process-step';
import { fromBoardState } from '@/core-next/convert';

import type { SASolution } from './types';

const PLAYER_INDEX = 0;

// Simulate a move sequence from a given starting state, returning
// the board state after each tick.
function simulateForward(
  startBoard: FlatBoard,
  moves: FlatMove[],
  startTick: number,
  totalTicks: number,
  timing: TimingConfig,
): FlatBoard[] {
  const states: FlatBoard[] = [];
  let board = cloneBoard(startBoard);

  for (let i = startTick; i < totalTicks; i++) {
    const move = moves[i] ?? null;
    processStep(board, move, PLAYER_INDEX, i + 1, timing);
    states.push(board);
    if (i < totalTicks - 1) {
      board = cloneBoard(board);
    }
  }

  return states;
}

function createInitialSolution(boardState: BoardState, totalTicks: number): SASolution {
  const timing = DEFAULT_TIMING;
  const initialBoard = fromBoardState(structuredClone(boardState), 1);

  const moves: FlatMove[] = new Array(totalTicks).fill(null);
  const forwardStates = simulateForward(initialBoard, moves, 0, totalTicks, timing);

  const stateCache = [initialBoard, ...forwardStates];
  const finalBoard = stateCache[stateCache.length - 1];
  const score = finalBoard.stats.landCounts[PLAYER_INDEX];

  return { moves, score, stateCache };
}

export { createInitialSolution, simulateForward, PLAYER_INDEX };

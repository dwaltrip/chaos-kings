import type { BoardState, Coord } from '@core/types';
import { DEFAULT_TIMING } from '@core/game-timing-config';
import type { TimingConfig } from '@core/timing/types';

import { cloneBoard } from '@/core-next/flat-board';
import type { FlatBoard } from '@/core-next/flat-board';
import { processStep } from '@/core-next/process-step';
import type { FlatMove } from '@/core-next/process-step';
import { fromBoardState } from '@/core-next/convert';

import { generateMoves } from '../moves';

import type { SASolution, SAConfig, SAResult } from './types';

const PLAYER_INDEX = 0;
const timing = DEFAULT_TIMING;

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
  const initialBoard = fromBoardState(structuredClone(boardState), 1);

  const moves: FlatMove[] = new Array(totalTicks).fill(null);
  const forwardStates = simulateForward(initialBoard, moves, 0, totalTicks, timing);

  const stateCache = [initialBoard, ...forwardStates];
  const finalBoard = stateCache[stateCache.length - 1];
  const score = finalBoard.stats.landCounts[PLAYER_INDEX];

  return { moves, score, stateCache };
}

// TODO: generateNeighbor rebuilds the full state cache (51 boards) on every call,
// even for rejected neighbors. When scaling to 1M+ iterations, consider returning
// only the changed suffix (states from tick t onward) and splicing on acceptance.
function generateNeighbor(current: SASolution): SASolution {
  const totalTicks = current.moves.length;

  // Pick a random tick index to modify
  const t = Math.floor(Math.random() * totalTicks);

  // stateCache[t] = board state before moves[t] is applied
  const boardAtT = current.stateCache[t];

  // Get legal moves at this state
  const legalMoves = generateMoves({ board: boardAtT });

  // Pick a random legal move, preferring one different from the current move
  let newMove: FlatMove = null;
  if (legalMoves.length > 1) {
    const currentMove = current.moves[t];
    const alternatives = legalMoves.filter((m) => !flatMovesEqual(m, currentMove));
    newMove =
      alternatives.length > 0
        ? alternatives[Math.floor(Math.random() * alternatives.length)]
        : legalMoves[Math.floor(Math.random() * legalMoves.length)];
  } else if (legalMoves.length === 1) {
    newMove = legalMoves[0];
  }

  // Build new move array
  const newMoves = [...current.moves];
  newMoves[t] = newMove;

  // Re-simulate from tick t forward
  const forwardStates = simulateForward(boardAtT, newMoves, t, totalTicks, timing);

  // Splice the state cache: keep [0..t], replace [t+1..end]
  const newStateCache = [...current.stateCache.slice(0, t + 1), ...forwardStates];
  const finalBoard = newStateCache[newStateCache.length - 1];
  const score = finalBoard.stats.landCounts[PLAYER_INDEX];

  return { moves: newMoves, score, stateCache: newStateCache };
}

function flatMovesEqual(a: FlatMove, b: FlatMove): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.src === b.src && a.dir === b.dir;
}

function runSA(boardState: BoardState, totalTicks: number, config: SAConfig): SAResult {
  const { iterations, t0, epsilon } = config;
  const alpha = Math.pow(epsilon, 1 / iterations);

  let current = createInitialSolution(boardState, totalTicks);
  let bestScore = current.score;
  let bestMoves = [...current.moves];
  let temperature = t0;
  let acceptedCount = 0;

  // Track best score at each 10% milestone
  const milestoneInterval = Math.floor(iterations / 10);
  const scoreProgression: number[] = [];

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const neighbor = generateNeighbor(current);
    const delta = neighbor.score - current.score;

    if (delta >= 0 || Math.random() < Math.exp(delta / temperature)) {
      current = neighbor;
      acceptedCount++;

      if (current.score > bestScore) {
        bestScore = current.score;
        bestMoves = [...current.moves];
      }
    }

    temperature *= alpha;

    if ((i + 1) % milestoneInterval === 0) {
      scoreProgression.push(bestScore);
    }
  }

  const runtimeMs = performance.now() - start;

  return {
    bestScore,
    bestMoves,
    scoreProgression,
    totalIterations: iterations,
    acceptedCount,
    runtimeMs,
  };
}

export { createInitialSolution, generateNeighbor, runSA, simulateForward, PLAYER_INDEX };

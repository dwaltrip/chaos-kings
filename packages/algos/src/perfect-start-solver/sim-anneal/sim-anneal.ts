import type { BoardState } from '@core/types';
import { DEFAULT_TIMING } from '@core/game-timing-config';
import type { TimingConfig } from '@core/timing/types';

import { cloneBoard, copyInto } from '@/core-next/flat-board';
import type { FlatBoard } from '@/core-next/flat-board';
import { Board } from '@/core-next/flat-board';
import { processStep } from '@/core-next/process-step';
import type { FlatMove } from '@/core-next/process-step';
import { fromBoardState } from '@/core-next/convert';

import { generateMoves } from '../moves';

import type { SASolution, SAConfig, SAResult } from './types';

const PLAYER_INDEX = 0;
const timing = DEFAULT_TIMING;

// --- Timing accumulators (optional profiling) ---

interface TimingAccum {
  genMoves: number;
  cloneBoard: number;
  processStep: number;
  arrayBuild: number;
  acceptance: number;
}

function createTimingAccum(): TimingAccum {
  return { genMoves: 0, cloneBoard: 0, processStep: 0, arrayBuild: 0, acceptance: 0 };
}

// --- Scratch buffer ---
// Pre-allocated boards reused each iteration to avoid allocation on the hot path.
// Only used in runSA's inner loop. On acceptance, scratch boards are cloned into
// durable boards for the stateCache.

function allocateScratchBoards(template: FlatBoard, count: number): FlatBoard[] {
  const boards: FlatBoard[] = [];
  const playerCount = template.stats.landCounts.length;
  for (let i = 0; i < count; i++) {
    boards.push(Board.create(template.width, template.height, playerCount));
  }
  return boards;
}

// Simulate forward into scratch boards. Returns the number of scratch boards used.
function simulateIntoScratch(
  startBoard: FlatBoard,
  moves: FlatMove[],
  startTick: number,
  totalTicks: number,
  timing: TimingConfig,
  scratch: FlatBoard[],
  ta?: TimingAccum,
): number {
  const count = totalTicks - startTick;

  let s: number;
  if (ta) s = performance.now();
  copyInto(scratch[0], startBoard);
  if (ta) ta.cloneBoard += performance.now() - s!;

  for (let i = 0; i < count; i++) {
    const tick = startTick + i;
    const move = moves[tick] ?? null;

    if (ta) s = performance.now();
    processStep(scratch[i], move, PLAYER_INDEX, tick + 1, timing);
    if (ta) ta.processStep += performance.now() - s!;

    if (i < count - 1) {
      if (ta) s = performance.now();
      copyInto(scratch[i + 1], scratch[i]);
      if (ta) ta.cloneBoard += performance.now() - s!;
    }
  }

  return count;
}

// --- Simulation (allocating version, used by non-hot-loop callers) ---

function simulateForward(
  startBoard: FlatBoard,
  moves: FlatMove[],
  startTick: number,
  totalTicks: number,
  timing: TimingConfig,
  ta?: TimingAccum,
): FlatBoard[] {
  const states: FlatBoard[] = [];

  let s: number;
  if (ta) s = performance.now();
  let board = cloneBoard(startBoard);
  if (ta) ta.cloneBoard += performance.now() - s!;

  for (let i = startTick; i < totalTicks; i++) {
    const move = moves[i] ?? null;

    if (ta) s = performance.now();
    processStep(board, move, PLAYER_INDEX, i + 1, timing);
    if (ta) ta.processStep += performance.now() - s!;

    states.push(board);
    if (i < totalTicks - 1) {
      if (ta) s = performance.now();
      board = cloneBoard(board);
      if (ta) ta.cloneBoard += performance.now() - s!;
    }
  }

  return states;
}

// --- Solution helpers ---

function createInitialSolution(boardState: BoardState, totalTicks: number): SASolution {
  const initialBoard = fromBoardState(structuredClone(boardState), 1);

  const moves: FlatMove[] = new Array(totalTicks).fill(null);
  const forwardStates = simulateForward(initialBoard, moves, 0, totalTicks, timing);

  const stateCache = [initialBoard, ...forwardStates];
  const finalBoard = stateCache[stateCache.length - 1];
  const score = finalBoard.stats.landCounts[PLAYER_INDEX];

  return { moves, score, stateCache };
}

function flatMovesEqual(a: FlatMove, b: FlatMove): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.src === b.src && a.dir === b.dir;
}

// Pick a random neighbor: change one random tick's move and re-simulate forward.
// Uses allocating simulateForward — suitable for external callers (e.g. delta-sampler).
function generateNeighbor(current: SASolution, ta?: TimingAccum): SASolution {
  const totalTicks = current.moves.length;
  const t = Math.floor(Math.random() * totalTicks);
  const boardAtT = current.stateCache[t];

  let s: number;
  if (ta) s = performance.now();
  const legalMoves = generateMoves({ board: boardAtT });
  if (ta) ta.genMoves += performance.now() - s!;

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

  const newMoves = [...current.moves];
  newMoves[t] = newMove;

  const forwardStates = simulateForward(boardAtT, newMoves, t, totalTicks, timing, ta);

  if (ta) s = performance.now();
  const newStateCache = [...current.stateCache.slice(0, t + 1), ...forwardStates];
  if (ta) ta.arrayBuild += performance.now() - s!;

  const finalBoard = newStateCache[newStateCache.length - 1];
  const score = finalBoard.stats.landCounts[PLAYER_INDEX];

  return { moves: newMoves, score, stateCache: newStateCache };
}

// --- Main SA loop ---

function runSA(boardState: BoardState, totalTicks: number, config: SAConfig): SAResult {
  const { iterations, t0, epsilon, profile: doProfile } = config;
  const alpha = Math.pow(epsilon, 1 / iterations);

  let current = createInitialSolution(boardState, totalTicks);
  let bestScore = current.score;
  let bestMoves = [...current.moves];
  let temperature = t0;
  let acceptedCount = 0;

  const milestoneInterval = Math.floor(iterations / 10);
  const scoreProgression: number[] = [];

  const ta = doProfile ? createTimingAccum() : undefined;

  // Pre-allocate scratch boards for forward simulation
  const scratch = allocateScratchBoards(current.stateCache[0], totalTicks);

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const t = Math.floor(Math.random() * totalTicks);
    const boardAtT = current.stateCache[t];

    // Generate moves
    let s: number;
    if (ta) s = performance.now();
    const legalMoves = generateMoves({ board: boardAtT });
    if (ta) ta.genMoves += performance.now() - s!;

    // Pick a random legal move, preferring one different from current
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

    const newMoves = [...current.moves];
    newMoves[t] = newMove;

    // Simulate forward into scratch boards (no allocation)
    const scratchCount = simulateIntoScratch(
      boardAtT,
      newMoves,
      t,
      totalTicks,
      timing,
      scratch,
      ta,
    );

    // Score from the last scratch board
    const score = scratch[scratchCount - 1].stats.landCounts[PLAYER_INDEX];
    const delta = score - current.score;

    if (delta >= 0 || Math.random() < Math.exp(delta / temperature)) {
      // Accepted — clone scratch boards into durable stateCache
      if (ta) s = performance.now();
      const forwardStates: FlatBoard[] = [];
      for (let j = 0; j < scratchCount; j++) {
        forwardStates.push(cloneBoard(scratch[j]));
      }
      if (ta) ta.cloneBoard += performance.now() - s!;

      if (ta) s = performance.now();
      const newStateCache = [...current.stateCache.slice(0, t + 1), ...forwardStates];
      if (ta) ta.arrayBuild += performance.now() - s!;

      current = { moves: newMoves, score, stateCache: newStateCache };
      acceptedCount++;
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [...newMoves];
      }
    }

    temperature *= alpha;

    if ((i + 1) % milestoneInterval === 0) {
      scoreProgression.push(bestScore);
    }
  }

  const runtimeMs = performance.now() - start;

  const result: SAResult = {
    bestScore,
    bestMoves,
    scoreProgression,
    totalIterations: iterations,
    acceptedCount,
    runtimeMs,
  };

  if (ta) {
    result.profile = {
      genMovesMs: ta.genMoves,
      simForwardMs: ta.cloneBoard + ta.processStep,
      cloneBoardMs: ta.cloneBoard,
      processStepMs: ta.processStep,
      arrayBuildMs: ta.arrayBuild,
      acceptanceMs: ta.acceptance,
      totalMs: runtimeMs,
    };
  }

  return result;
}

// Rebuild a full SASolution from a move sequence by re-simulating from scratch.
function buildSolution(
  boardState: BoardState,
  moves: FlatMove[],
  totalTicks: number,
): SASolution {
  const initialBoard = fromBoardState(structuredClone(boardState), 1);
  const forwardStates = simulateForward(initialBoard, moves, 0, totalTicks, timing);

  const stateCache = [initialBoard, ...forwardStates];
  const finalBoard = stateCache[stateCache.length - 1];
  const score = finalBoard.stats.landCounts[PLAYER_INDEX];

  return { moves: [...moves], score, stateCache };
}

export {
  buildSolution,
  createInitialSolution,
  generateNeighbor,
  runSA,
  simulateForward,
  PLAYER_INDEX,
};

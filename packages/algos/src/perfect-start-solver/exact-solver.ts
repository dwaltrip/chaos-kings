import type { BoardState, Coord } from '@core/types';
import { DEFAULT_TIMING } from '@core/game-timing-config';

import { cloneBoard } from '@/core-next/flat-board';
import type { FlatBoard } from '@/core-next/flat-board';
import { processStep } from '@/core-next/process-step';
import type { FlatMove } from '@/core-next/process-step';
import { fromBoardState } from '@/core-next/convert';

import { generateMoves, fingerprintState, flatMoveToMove } from './moves';
import { runWithTiming } from './helpers';
import type { Move } from './types';

interface ExactSolverConfig {
  maxTicks: number;
}

interface ExactSolverResult {
  bestLand: number;
  moves: Move[];
  statesPerTick: number[];
  totalTimeMs: number;
}

interface SearchState {
  board: FlatBoard;
  moves: FlatMove[];
}

function solveExact(
  boardState: BoardState,
  generalCoord: Coord,
  config: ExactSolverConfig,
): ExactSolverResult {
  const timing = DEFAULT_TIMING;
  const board = fromBoardState(structuredClone(boardState), 1);

  const initialFp = fingerprintState(board);
  let states = new Map<string, SearchState>();
  states.set(initialFp, { board, moves: [] });

  let bestLand = board.stats.landCounts[0];
  let bestMoves: FlatMove[] = [];
  const statesPerTick: number[] = [1];

  const [, totalTimeMs] = runWithTiming(() => {
    for (let tick = 1; tick <= config.maxTicks; tick++) {
      const nextStates = new Map<string, SearchState>();

      for (const state of states.values()) {
        const legalMoves = generateMoves(state);

        for (const move of legalMoves) {
          const childBoard = cloneBoard(state.board);
          processStep(childBoard, move, 0, tick, timing);
          const fp = fingerprintState(childBoard);

          if (!nextStates.has(fp)) {
            nextStates.set(fp, {
              board: childBoard,
              moves: [...state.moves, move],
            });
          }
        }
      }

      states = nextStates;
      statesPerTick.push(states.size);

      // Track best land
      let tickBestLand = 0;
      let tickBestMoves: FlatMove[] = [];
      for (const state of states.values()) {
        const land = state.board.stats.landCounts[0];
        if (land > tickBestLand) {
          tickBestLand = land;
          tickBestMoves = state.moves;
        }
      }
      if (tickBestLand > bestLand) {
        bestLand = tickBestLand;
        bestMoves = tickBestMoves;
      }

      console.log(
        `  tick ${String(tick).padStart(2)}: ${String(states.size).padStart(8)} states` +
          `  |  best land: ${tickBestLand}`,
      );
    }
  });

  // Reconstruct Move[] from FlatMove[] using the final board for coord conversion
  const resultBoard = board; // any board works for coord conversion
  const moves = bestMoves.map((m) => flatMoveToMove(m, resultBoard));

  return { bestLand, moves, statesPerTick, totalTimeMs };
}

export type { ExactSolverConfig, ExactSolverResult };
export { solveExact };

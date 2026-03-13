import type { BoardState, Coord, Direction, GameState } from '@core/types';
import { SquareType } from '@core/types';
import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import { processStep, createGameState } from '@core/step-processor';
import { DEFAULT_TIMING } from '@core/game-timing-config';
import type { TimingConfig } from '@core/timing/types';
import type { MoveEvent } from '@core/replay/types';

import { beamSearch } from './beam-search';
import type { Move, ScoringFn, SolverConfig, SolverResult } from './types';

const ALL_DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

interface SolverState {
  gameState: GameState;
  moves: Move[];
}

function generateMoves(state: SolverState): Move[] {
  const { gameState } = state;
  const moves: Move[] = [null]; // wait is always an option

  for (const coord of Board.iterCoords(gameState.board)) {
    const square = Board.getSquare(gameState.board, coord);
    if (!isPlayerSquare(square) || square.playerIndex !== 0 || square.units <= 1) {
      continue;
    }
    for (const direction of ALL_DIRECTIONS) {
      if (Board.canMove(gameState.board, coord, direction)) {
        moves.push({ sourceCoord: coord, direction });
      }
    }
  }

  return moves;
}

function cloneState(state: SolverState): SolverState {
  return {
    gameState: structuredClone(state.gameState),
    moves: [...state.moves],
  };
}

function stepState(state: SolverState, move: Move, timing: TimingConfig): void {
  const step = state.gameState.tick + 1;
  const events: MoveEvent[] = [];

  if (move !== null) {
    events.push({
      step,
      playerIndex: 0,
      sourceCoord: move.sourceCoord,
      direction: move.direction,
    });
  }

  processStep(state.gameState, events, timing);
  state.moves.push(move);
}

function solve(
  board: BoardState,
  generalCoord: Coord,
  config: SolverConfig,
): SolverResult {
  const timing = DEFAULT_TIMING;
  const gameState = createGameState(structuredClone(board), 1);

  const initial: SolverState = {
    gameState,
    moves: [],
  };

  const result = beamSearch<SolverState, Move>(initial, {
    generateMoves,
    clone: cloneState,
    step: (state, move) => stepState(state, move, timing),
    score: (state) => config.scoringFn(state.gameState),
    beamWidth: config.beamWidth,
    numSteps: config.maxTicks,
  });

  const bestState = result.best;

  return {
    finalLand: bestState.gameState.players[0].landCount,
    landCurve: result.scorePerStep,
    moves: bestState.moves,
  };
}

export { solve };

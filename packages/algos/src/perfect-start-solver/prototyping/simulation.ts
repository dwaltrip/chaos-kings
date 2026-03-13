import type { BoardState, Coord, GameState } from '@core/types';
import type { TimingConfig } from '@core/timing/types';
import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import { processStep, createGameState } from '@core/step-processor';
import { DEFAULT_TIMING } from '@core/game-timing-config';

import { toMoveEvent } from './helpers';
import type { Move, SimulationResult } from './types';

function getGeneralArmy(gameState: GameState, generalCoord: Coord): number {
  const square = Board.getSquare(gameState.board, generalCoord);
  if (isPlayerSquare(square)) return square.units;
  return 0;
}

function simulate(
  board: BoardState,
  moves: Move[],
  ticks: number,
  generalCoord: Coord,
  timing: TimingConfig = DEFAULT_TIMING,
): SimulationResult {
  const gameState = createGameState(board, 1);
  const landCurve: number[] = [gameState.players[0].landCount];
  const generalArmyCurve: number[] = [getGeneralArmy(gameState, generalCoord)];

  for (let i = 0; i < ticks; i++) {
    const tick = gameState.tick + 1;
    const move = i < moves.length ? moves[i] : null;
    const event = toMoveEvent(move, tick);
    const events = event ? [event] : [];

    processStep(gameState, events, timing);
    landCurve.push(gameState.players[0].landCount);
    generalArmyCurve.push(getGeneralArmy(gameState, generalCoord));
  }

  return {
    finalLand: gameState.players[0].landCount,
    landCurve,
    generalArmyCurve,
    finalState: gameState,
  };
}

export { simulate };

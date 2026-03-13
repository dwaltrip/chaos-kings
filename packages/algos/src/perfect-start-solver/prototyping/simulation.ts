import type { BoardState, Coord } from '@core/types';
import type { TimingConfig } from '@core/timing/types';
import type { MoveEvent } from '@core/replay/types';
import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import { processStep, createGameState } from '@core/step-processor';
import { DEFAULT_TIMING } from '@core/game-timing-config';

import type { Move, SimulationResult } from './types';

function getGeneralArmy(gameState: { board: BoardState }, generalCoord: Coord): number {
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
    const step = gameState.tick + 1;
    const move = i < moves.length ? moves[i] : null;

    const events: MoveEvent[] = [];
    if (move !== null) {
      events.push({
        step,
        playerIndex: 0,
        sourceCoord: move.sourceCoord,
        direction: move.direction,
      });
    }

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

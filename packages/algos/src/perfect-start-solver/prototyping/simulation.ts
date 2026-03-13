import type { BoardState } from '@core/types';
import type { TimingConfig } from '@core/timing/types';
import type { MoveEvent } from '@core/replay/types';
import { processStep, createGameState } from '@core/step-processor';
import { DEFAULT_TIMING } from '@core/game-timing-config';

import type { Move, SimulationResult } from './types';

function simulate(
  board: BoardState,
  moves: Move[],
  ticks: number,
  timing: TimingConfig = DEFAULT_TIMING,
): SimulationResult {
  const gameState = createGameState(board, 1);
  const landCurve: number[] = [gameState.players[0].landCount];

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
  }

  return {
    finalLand: gameState.players[0].landCount,
    landCurve,
    finalState: gameState,
  };
}

export { simulate };

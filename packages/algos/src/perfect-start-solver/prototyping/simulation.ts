import type { BoardState, Coord, GameState } from '@core/types';
import type { TimingConfig } from '@core/timing/types';
import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import { processStep, createGameState } from '@core/step-processor';
import { DEFAULT_TIMING } from '@core/game-timing-config';

import { toMoveEvent } from '../helpers';
import type { Move, ArmySnapshot, SimulationResult } from '../types';

function getGeneralArmy(gameState: GameState, generalCoord: Coord): number {
  const square = Board.getSquare(gameState.board, generalCoord);
  if (isPlayerSquare(square)) return square.units;
  return 0;
}

function getTopArmies(gameState: GameState, count: number): ArmySnapshot[] {
  const armies: ArmySnapshot[] = [];
  for (const coord of Board.iterCoords(gameState.board)) {
    const square = Board.getSquare(gameState.board, coord);
    if (isPlayerSquare(square) && square.playerIndex === 0 && square.units > 1) {
      armies.push({ coord, units: square.units });
    }
  }
  armies.sort((a, b) => b.units - a.units);
  return armies.slice(0, count);
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
  const armySnapshots: ArmySnapshot[][] = [getTopArmies(gameState, 5)];

  for (let i = 0; i < ticks; i++) {
    const tick = gameState.tick + 1;
    const move = i < moves.length ? moves[i] : null;
    const event = toMoveEvent(move, tick);
    const events = event ? [event] : [];

    processStep(gameState, events, timing);
    landCurve.push(gameState.players[0].landCount);
    generalArmyCurve.push(getGeneralArmy(gameState, generalCoord));
    armySnapshots.push(getTopArmies(gameState, 5));
  }

  return {
    finalLand: gameState.players[0].landCount,
    landCurve,
    generalArmyCurve,
    armySnapshots,
    finalState: gameState,
  };
}

export { simulate };

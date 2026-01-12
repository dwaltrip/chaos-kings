import { Board } from '@core/board';
import type { BoardState } from '@core/types';
import type { BestStartResult } from './types';

function scoreBestStart(board: BoardState): BestStartResult {
  let landCount = 0;
  let armyCount = 0;

  // Player 0 is always the puzzle player
  for (const square of Board.iterPlayerSquares(board, 0)) {
    landCount++;
    armyCount += square.units;
  }

  return { landCount, armyCount };
}

export { scoreBestStart };

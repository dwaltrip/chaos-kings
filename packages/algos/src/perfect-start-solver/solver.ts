import type { Coord, BoardState } from '@core/types';
import { Board } from '@core/board';
import { isGeneralSquare } from '@core/square';

function solve(board: BoardState, start: Coord) {
  const startTile = Board.getSquare(board, start);
  if (!isGeneralSquare(startTile)) {
    throw new Error('Starting tile is not a general square');
  }

  console.log(startTile);
}

export { solve };

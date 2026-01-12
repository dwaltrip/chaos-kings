// TODO: move to a more generic location and reuse in gameplay page
import type { BoardState } from '@core/types';
import { Board } from '@core/board';

let cachedTick: number | null = null;
let cachedVisibleSquares: Set<string> | null = null;

function getVisibleSquaresForPuzzle(board: BoardState, tick: number): Set<string> {
  if (cachedTick === tick && cachedVisibleSquares) {
    return cachedVisibleSquares;
  }

  cachedVisibleSquares = Board.getVisibleSquares(board, 0);
  cachedTick = tick;
  return cachedVisibleSquares;
}

function clearVisibilityCache(): void {
  cachedTick = null;
  cachedVisibleSquares = null;
}

export { getVisibleSquaresForPuzzle, clearVisibilityCache };

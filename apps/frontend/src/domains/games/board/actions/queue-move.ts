import type { Coord, Direction } from '@core/types';
import { Board } from '@core/board';

import { boardStore, addQueuedMove, setSelectedTile } from '@/domains/games/board-store';

function queueMoveOnBoard(source: Coord, direction: Direction): boolean {
  const board = boardStore.state.game.board;
  if (!board) return false;
  if (!Board.canMove(board, source, direction)) return false;

  addQueuedMove({ sourceCoord: source, direction });
  setSelectedTile(Board.applyDirection(source, direction));
  return true;
}

export { queueMoveOnBoard };

import type { Coord, Direction } from '@core/types';
import { Board } from '@core/board';

import { boardStore, addQueuedMove, setSelectedTile } from '@/domains/games/board-store';
import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

function queueMove(source: Coord, direction: Direction): void {
  const board = boardStore.state.game.board;
  if (!board) return;

  if (!Board.canMove(board, source, direction)) {
    return;
  }

  addQueuedMove({ sourceCoord: source, direction });

  const newSelected = Board.applyDirection(source, direction);
  setSelectedTile(newSelected);

  puzzlesWsEffects.sendMoveRequest(source, direction);
}

export { queueMove };

import type { Coord, Direction } from '@core/types';
import { Board } from '@core/board';

import { boardStore, addQueuedMove, setSelectedTile } from '@/domains/games/board-store';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function queueMove(selectedTile: Coord, direction: Direction): void {
  const board = boardStore.state.game.board;

  if (!board) {
    console.debug('Cannot move: no board');
    return;
  }

  if (!Board.canMove(board, selectedTile, direction)) {
    return;
  }

  addQueuedMove({ sourceCoord: selectedTile, direction });
  setSelectedTile(Board.applyDirection(selectedTile, direction));

  sandboxWsEffects.sendMoveRequest(selectedTile, direction);
}

export { queueMove };

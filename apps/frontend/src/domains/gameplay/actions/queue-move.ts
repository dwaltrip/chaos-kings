import type { Coord, Direction } from '@core/types';
import { Board } from '@core/board';

import { boardStore, addQueuedMove, setSelectedTile } from '@/domains/games/board-store';
import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';

function queueMove(direction: Direction, selectedTile: Coord | null) {
  const board = boardStore.state.game.board;

  if (!selectedTile) {
    console.debug('Cannot move: no tile selected');
    return;
  }
  if (!board) {
    return;
  }
  if (!Board.canMove(board, selectedTile, direction)) {
    return;
  }

  addQueuedMove({ sourceCoord: selectedTile, direction });
  setSelectedTile(Board.applyDirection(selectedTile, direction));

  gameplayWsEffects.sendMoveRequest(selectedTile, direction);
}

export { queueMove };

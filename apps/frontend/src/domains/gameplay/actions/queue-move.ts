import type { BoardState, Coord, Direction } from '@core/types';
import { Board } from '@core/board';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';

import { getWebSocketService } from '@/services/websocket-service';
import { gameplayActions } from '@/game-ui/store/gameplay-store-v2';

function queueMove(direction: Direction, selectedTile: Coord | null, board: BoardState) {
  const { addQueuedMove, setSelectedTileV2 } = gameplayActions();
  if (!selectedTile) {
    console.debug('Cannot move: no tile selected');
    return;
  }

  // This shouldn't be necessary for 2 reasons:
  // 1. The UI should prevent invalid moves
  // 2. The server will reject invalid moves anyway
  // TODO: remove it?
  if (!Board.canMove(board, selectedTile, direction)) {
    return;
  }

  // Immediately add to local queue for instant arrow feedback
  addQueuedMove({ sourceCoord: selectedTile, direction });
  // Move selected tile to the new target tile
  setSelectedTileV2(Board.applyDirection(selectedTile, direction));

  // Send to server
  const wsService = getWebSocketService();
  wsService.send({
    domain: GAMEPLAY_DOMAIN,
    type: 'move-request',
    payload: {
      sourceCoord: selectedTile,
      direction,
    },
  });
}

export { queueMove };

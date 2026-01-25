import type { Coord, Direction } from '@core/types';
import { Board } from '@core/board';

import { getTileStore } from '@/domains/games/stores/tile-store-registry';
import { useBoardSessionStore } from '@/domains/games/stores/board-session-store';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function queueMove(selectedTile: Coord, direction: Direction): void {
  const { board, actions } = useBoardSessionStore.getState();
  const { addQueuedMove, setSelectedTile } = actions;

  if (!board) {
    console.debug('Cannot move: no board');
    return;
  }

  if (!Board.canMove(board, selectedTile, direction)) {
    return;
  }

  addQueuedMove({ sourceCoord: selectedTile, direction });

  const tileStore = getTileStore(selectedTile);
  tileStore.getState().addQueuedDirection(direction);

  setSelectedTile(Board.applyDirection(selectedTile, direction));

  sandboxWsEffects.sendMoveRequest(selectedTile, direction);
}

export { queueMove };

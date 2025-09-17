import { Board } from '@core/board';
import { areCoordsEqual } from '@core/utils/coordinate-utils';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';

import { copySetAndRemoveItem } from '@/lib/set-utils';
import { getWebSocketService } from '@/services/websocket-service';
import {
  gameplayActions,
  useGameplayStoreV2,
} from '@/game-ui/store/gameplay-store-v2';
import { getTileStore } from '@/game-ui/store/tile-store-registry';

function undoLastQueuedMove() {
  const { queuedMoves, game } = useGameplayStoreV2.getState();
  if (!game?.id || queuedMoves.length === 0) {
    return;
  }
  applyOptimisticUpdates();

  const wsService = getWebSocketService();
  wsService.send({
    domain: GAMEPLAY_DOMAIN,
    type: 'undo-move-request',
    // TODO: this is not being typed properly, it allows any??
    payload: { gameId: game.id },
  });
}

function applyOptimisticUpdates() {
  const { setSelectedTileV2, setQueuedMoves } = gameplayActions();
  const { queuedMoves } = useGameplayStoreV2.getState();
  if (queuedMoves.length === 0) {
    return;
  }
  const lastMove = queuedMoves[queuedMoves.length - 1];

  // upate moves for source tile
  const tileStore = getTileStore(lastMove.sourceCoord);
  const directionsForTile = copySetAndRemoveItem(
    tileStore.getState().queuedDirections,
    lastMove.direction,
  );
  tileStore.getState().updateQueuedDirections(directionsForTile);

  // update selected tile if we are moving from currently selected tile
  const dest = Board.applyDirection(lastMove.sourceCoord, lastMove.direction);
  const selectedTile = useGameplayStoreV2.getState().selectedTile;
  if (selectedTile && areCoordsEqual(selectedTile, dest)) {
    setSelectedTileV2(lastMove.sourceCoord);
  }

  // update list of all queued moves for the player
  setQueuedMoves(queuedMoves.slice(0, -1));
}

export { undoLastQueuedMove };

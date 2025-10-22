import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';

import { getWebSocketService } from '@/services/websocket-service';
import { tileOrchestrator } from '@/game-ui/store/tile-orchestrator';
import { gameplayActions } from '@/game-ui/store/gameplay-store-v2';

function cancelQueuedMoves() {
  const { setQueuedMoves } = gameplayActions();
  const wsService = getWebSocketService();

  // Optimistically clear FE state
  tileOrchestrator.updateQueuedDirections(new Map());
  setQueuedMoves([]);

  wsService.send({
    domain: GAMEPLAY_DOMAIN,
    type: 'cancel-moves-request',
    payload: null,
  });
}

export { cancelQueuedMoves };

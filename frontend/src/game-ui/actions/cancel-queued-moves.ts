import { getWebSocketService } from '@/services/websocket-service';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import { tileOrchestrator } from '../store/tile-orchestrator';
import { useGameplayStoreV2 } from '../store/gameplay-store-v2';

function cancelQueuedMoves() {
  const wsService = getWebSocketService();

  // Optimistically clear FE state
  tileOrchestrator.updateQueuedMoves(new Map());
  useGameplayStoreV2.getState().actions.setQueuedMoves([]);

  wsService.send({
    domain: GAMEPLAY_DOMAIN,
    type: 'cancel-moves-request',
    payload: null,
  });
}

export { cancelQueuedMoves };

import { getWebSocketService } from '@/services/websocket-service';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';

// TODO: this doesn't do any optimistic FE updates
// unlike undoLastQueuedMove...
// Should it? or does undoLastQueuedMove not need to either?
function cancelQueuedMoves() {
  const wsService = getWebSocketService();
  wsService.send({
    domain: GAMEPLAY_DOMAIN,
    type: 'cancel-moves-request',
    payload: null,
  });
}

export { cancelQueuedMoves };

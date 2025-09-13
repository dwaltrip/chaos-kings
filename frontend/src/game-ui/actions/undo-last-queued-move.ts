import { getWebSocketService } from '@/services/websocket-service';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import { gameplayStore } from '@/game-ui/store/gameplay-store';

const { actions } = gameplayStore.getState();

function undoLastQueuedMove() {
  const state = gameplayStore.getState();
  const { queuedMoves } = state;
  if (queuedMoves.length === 0) {
    return;
  }
  actions.undoQueuedMove();

  const wsService = getWebSocketService();
  wsService.send({
    domain: GAMEPLAY_DOMAIN,
    type: 'undo-move-request',
    // TODO: this is not being typed properly, it allows any??
    payload: {
      gameId: gameplayStore.getState().gameId,
    },
  });
}

export { undoLastQueuedMove };

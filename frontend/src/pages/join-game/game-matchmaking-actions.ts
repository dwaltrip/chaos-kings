import { gameMatchmakingStore } from '@/pages/join-game/join-game-store';
import { getWebSocketService } from '@/services/websocket-service';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';

const { actions } = gameMatchmakingStore.getState();

function websocketConnect(): ReturnType<typeof getWebSocketService> {
  const wsService = getWebSocketService();

  wsService.onReadyOrNow().then(() => {
    joinRoom(MATCHMAKING_ROOM_NAME);
  });
  return wsService;
}

function joinQueue() {
  const wsService = getWebSocketService();
  wsService.send({
    domain: 'game-matchmaking',
    type: 'join-queue',
    payload: null
  });
  actions.setIsInQueue(true);
}

function leaveQueue() {
  const wsService = getWebSocketService();
  wsService.send({
    domain: 'game-matchmaking',
    type: 'leave-queue',
    payload: null
  });
  actions.setIsInQueue(false);
}

function requestQueueStatus() {
  const wsService = getWebSocketService();
  wsService.send({
    domain: 'game-matchmaking',
    type: 'queue-status',
    payload: null
  });
}

function joinRoom(room: string) {
  const wsService = getWebSocketService();
  wsService.send({
    domain: 'game-chat',
    type: 'join-room',
    payload: { room }
  });
}

function cleanup() {
  actions.setIsInQueue(false);
}

export {
  websocketConnect,
  joinQueue,
  leaveQueue,
  requestQueueStatus,
  cleanup,
};


import { gameMatchmakingStore } from '@/pages/join-game/join-game-store';
import { getWebSocketService } from '@/services/websocket-service';
import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';

const { actions } = gameMatchmakingStore.getState();

function joinQueue() {
  const wsService = getWebSocketService();
  wsService.send({
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'join-queue',
    payload: null,
  });
  actions.setIsInQueue(true);
}

function leaveQueue() {
  const wsService = getWebSocketService();
  wsService.send({
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'leave-queue',
    payload: null,
  });
  actions.setIsInQueue(false);
}

function sendEarlyStartVote(vote: boolean) {
  const wsService = getWebSocketService();
  wsService.send({
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'early-start-vote',
    payload: { vote },
  });
}

export { joinQueue, leaveQueue, sendEarlyStartVote };

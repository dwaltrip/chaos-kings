import type { WsActions } from '@/websocket/types';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';
import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { getGlobalWebSocketManager } from '@/websocket/global-manager';

interface GameMatchmakingEffects {
  joinMatchmakingRoom(): void;
  broadcastQueueStatus(queueSize: number, playersNeeded: number): void;
  broadcastEarlyStartStatus(status: {
    voters: string[];
    queueSize: number;
    allVoted: boolean;
  }): void;
  broadcastGameReady(gameId: number): void;
  removeUsersFromMatchmakingRoom(userIds: number[]): void;
}

function createMatchmakingEffects(
  wsActions: WsActions,
): GameMatchmakingEffects {
  return {
    joinMatchmakingRoom() {
      wsActions.joinRoom(MATCHMAKING_ROOM_NAME);
    },
    broadcastQueueStatus(queueSize, playersNeeded) {
      wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
        domain: GAME_MATCHMAKING_DOMAIN,
        type: 'queue-status',
        payload: { queueSize, playersNeeded },
      });
    },
    broadcastEarlyStartStatus(status) {
      wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
        domain: GAME_MATCHMAKING_DOMAIN,
        type: 'early-start-status',
        payload: status,
      });
    },
    broadcastGameReady(gameId) {
      wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
        domain: GAME_MATCHMAKING_DOMAIN,
        type: 'game-ready',
        payload: { gameId },
      });
    },
    removeUsersFromMatchmakingRoom(userIds) {
      const wsManager = getGlobalWebSocketManager();
      userIds.forEach((id) =>
        wsManager.removeUserFromRoom(String(id), MATCHMAKING_ROOM_NAME),
      );
    },
  };
}

export { createMatchmakingEffects, type GameMatchmakingEffects };

import type { ClientWsActions } from '@/websocket/types';
import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { roomKey } from '@common/utils/room-key';
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

function createMatchmakingEffects(wsActions: ClientWsActions): GameMatchmakingEffects {
  const ROOM = roomKey(GAME_MATCHMAKING_DOMAIN, 'queue');
  return {
    joinMatchmakingRoom() {
      wsActions.join(ROOM);
    },
    broadcastQueueStatus(queueSize, playersNeeded) {
      wsActions.broadcast(ROOM, {
        domain: GAME_MATCHMAKING_DOMAIN,
        type: 'queue-status',
        payload: { queueSize, playersNeeded },
      });
    },
    broadcastEarlyStartStatus(status) {
      wsActions.broadcast(ROOM, {
        domain: GAME_MATCHMAKING_DOMAIN,
        type: 'early-start-status',
        payload: status,
      });
    },
    broadcastGameReady(gameId) {
      wsActions.broadcast(ROOM, {
        domain: GAME_MATCHMAKING_DOMAIN,
        type: 'game-ready',
        payload: { gameId },
      });
    },
    removeUsersFromMatchmakingRoom(userIds) {
      const wsManager = getGlobalWebSocketManager();
      userIds.forEach((id) => wsManager.removeUserFromRoom(String(id), ROOM));
    },
  };
}

export { createMatchmakingEffects, type GameMatchmakingEffects };

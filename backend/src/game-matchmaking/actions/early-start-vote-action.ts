import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import { WsActions } from '@/websocket/types';
import { spawnGameInstance } from './spawn-game-action';
import { getGlobalWebSocketManager } from '@/websocket/global-manager';

export async function earlyStartVote(
  userId: number,
  vote: boolean,
  wsActions: WsActions,
): Promise<void> {
  const matchmakingService = await getMatchmakingService();
  await matchmakingService.setEarlyStartVote(userId, vote);

  // Check if this triggers a match (unanimous >= 2) or full lobby
  const game = await matchmakingService.checkForMatch();
  if (game) {
    try {
      await spawnGameInstance(game.gameId);

      // Broadcast game-ready to matchmaking room BEFORE removing users
      wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
        domain: GAME_MATCHMAKING_DOMAIN,
        type: 'game-ready',
        payload: { gameId: game.gameId },
      });

      // Now remove users from matchmaking room
      const wsManager = getGlobalWebSocketManager();
      game.players.forEach((p) => {
        wsManager.removeUserFromRoom(
          p.playerId.toString(),
          MATCHMAKING_ROOM_NAME,
        );
      });
    } catch (error) {
      console.error(
        `Failed to spawn game instance for game ${game.gameId}:`,
        error,
      );
    }
  }

  // Broadcast updated queue status
  const queueStatus = await matchmakingService.getQueueStatus();
  wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'queue-status',
    payload: {
      queueSize: queueStatus.queueSize,
      playersNeeded: queueStatus.playersNeeded,
    },
  });

  // Broadcast early-start status
  const earlyStatus = await matchmakingService.getEarlyStartStatus();
  wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'early-start-status',
    payload: earlyStatus,
  });
}

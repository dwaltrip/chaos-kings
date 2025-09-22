import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import { WsActions } from '@/websocket/types';
import { spawnGameInstance } from './spawn-game-action';
import { getGlobalWebSocketManager } from '@/websocket/global-manager';

export async function joinQueue(
  userId: number,
  username: string,
  wsActions: WsActions,
): Promise<void> {
  wsActions.joinRoom(MATCHMAKING_ROOM_NAME);

  const matchmakingService = await getMatchmakingService();
  const game = await matchmakingService.addPlayer(userId, {
    username,
  });

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
      console.log(
        `Game ${game.gameId} ready; broadcasted and removed from room`,
      );
    } catch (error) {
      console.error(
        `Failed to spawn game instance for game ${game.gameId}:`,
        error,
      );
      // TODO: Should probably notify players of the error
    }
  }

  const queueStatus = await matchmakingService.getQueueStatus();
  wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'queue-status',
    payload: {
      queueSize: queueStatus.queueSize,
      playersNeeded: queueStatus.playersNeeded,
    },
  });

  // Broadcast early-start status after join (votes reset on membership change)
  const earlyStatus = await matchmakingService.getEarlyStartStatus();
  wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'early-start-status',
    payload: earlyStatus,
  });
}

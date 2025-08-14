import {
  GameMatchmaking,
  GAME_MATCHMAKING_DOMAIN,
} from '@common/types/game-matchmaking';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import { WsActions } from '@/websocket/types';
import { spawnGameInstance } from './spawn-game-action';

export async function handleJoinQueue(
  data: GameMatchmaking.JoinQueueMessage,
  wsActions: WsActions,
): Promise<void> {
  if (!data.user) {
    console.error('No user data in join-queue message');
    return;
  }

  wsActions.joinRoom(MATCHMAKING_ROOM_NAME);

  const matchmakingService = await getMatchmakingService();
  const game = await matchmakingService.addPlayer(data.user.id, {
    username: data.user.username,
  });

  if (game) {
    wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
      domain: GAME_MATCHMAKING_DOMAIN,
      type: 'game-ready',
      payload: { gameId: game.gameId },
    });

    // Spawn game instance after 1-second delay (matches frontend navigation)
    setTimeout(async () => {
      try {
        await spawnGameInstance(game.gameId);
      } catch (error) {
        console.error(
          `Failed to spawn game instance for game ${game.gameId}:`,
          error,
        );
      }
    }, 1000);
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
}

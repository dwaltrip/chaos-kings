import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import type { GameMatchmakingEffects } from '@/game-matchmaking/ws-effects';
import { spawnGameInstance } from './spawn-game-action';
import { getGlobalWebSocketManager } from '@/websocket/global-manager';

export async function earlyStartVote(
  userId: number,
  vote: boolean,
  effects: GameMatchmakingEffects,
): Promise<void> {
  const matchmakingService = await getMatchmakingService();
  await matchmakingService.setEarlyStartVote(String(userId), vote);

  // Check if this triggers a match (unanimous >= 2) or full lobby
  const game = await matchmakingService.checkForMatch();
  if (game) {
    try {
      await spawnGameInstance(game.gameId);

      // Broadcast game-ready to matchmaking room BEFORE removing users
      effects.broadcastGameReady(game.gameId);

      // Now remove users from matchmaking room
      effects.removeUsersFromMatchmakingRoom(
        game.players.map((p) => parseInt(p.playerId, 10)),
      );
    } catch (error) {
      console.error(
        `Failed to spawn game instance for game ${game.gameId}:`,
        error,
      );
    }
  }

  // Broadcast updated queue status
  const queueStatus = await matchmakingService.getQueueStatus();
  effects.broadcastQueueStatus(
    queueStatus.queueSize,
    queueStatus.playersNeeded,
  );

  // Broadcast early-start status
  const earlyStatus = await matchmakingService.getEarlyStartStatus();
  effects.broadcastEarlyStartStatus(earlyStatus);
}

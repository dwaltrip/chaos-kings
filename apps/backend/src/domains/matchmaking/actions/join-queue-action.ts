import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import { spawnGameInstance } from './spawn-game-action';
import type { GameMatchmakingEffects } from '@/game-matchmaking/ws-effects';

export async function joinQueue(
  userId: number,
  username: string,
  effects: GameMatchmakingEffects,
): Promise<void> {
  effects.joinMatchmakingRoom();

  const matchmakingService = await getMatchmakingService();
  const game = await matchmakingService.addPlayer(String(userId), {
    username,
  });

  if (game) {
    try {
      await spawnGameInstance(game.gameId);
      // Broadcast game-ready to matchmaking room BEFORE removing users
      effects.broadcastGameReady(game.gameId);

      // Now remove users from matchmaking room
      effects.removeUsersFromMatchmakingRoom(
        game.players.map((p) => parseInt(p.playerId, 10)),
      );
      console.log(`Game ${game.gameId} ready; broadcasted and removed from room`);
    } catch (error) {
      console.error(`Failed to spawn game instance for game ${game.gameId}:`, error);
      // TODO: Should probably notify players of the error
    }
  }

  const queueStatus = await matchmakingService.getQueueStatus();
  effects.broadcastQueueStatus(queueStatus.queueSize, queueStatus.playersNeeded);

  // Broadcast early-start status after join (votes reset on membership change)
  const earlyStatus = await matchmakingService.getEarlyStartStatus();
  effects.broadcastEarlyStartStatus(earlyStatus);
}

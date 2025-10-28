import type { MatchmakingGame } from '@/domains/matchmaking/matchmaking-service';
import { matchmakingWsEffects } from '@/domains/matchmaking/ws-effects';
import { spawnGameInstance } from '@/domains/matchmaking/actions/spawn-game-action';

async function handleGameSpawn(game: MatchmakingGame): Promise<void> {
  try {
    await spawnGameInstance(game.gameId);

    // Broadcast game-ready to matchmaking room BEFORE removing users
    matchmakingWsEffects.broadcastGameReady(game.gameId);

    // Now remove users from matchmaking room
    matchmakingWsEffects.removeUsersFromMatchmakingRoom(
      game.players.map((entry) => entry.playerId),
    );

    console.log(`Game ${game.gameId} ready; broadcasted and removed from room`);
  } catch (error) {
    console.error(`Failed to spawn game instance for game ${game.gameId}:`, error);
    // TODO: Should probably notify players of the error
  }
}

export { handleGameSpawn };

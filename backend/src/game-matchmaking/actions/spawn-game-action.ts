import { getGameCoordinator } from '@/gameplay/game-coordinator';
import { addUserToGame } from '@/gameplay/gameplay-ws-api';
import { getGame } from '@/game/actions/get-game';
import { getGlobalWebSocketManager } from '@/websocket/global-manager';
import { GameRepository } from '@/game/game-repository';
import { GameStatus } from '@/game/types';

export async function spawnGameInstance(gameId: number): Promise<void> {
  console.log(`Spawning game instance for game ${gameId}`);

  // Get game data with players
  const gameData = await getGame(gameId);
  if (!gameData) {
    throw new Error(`Game ${gameId} not found when spawning instance`);
  }

  // Add game to coordinator (this creates the GameServer instance)
  const gameCoordinator = getGameCoordinator();
  gameCoordinator.addGame(gameId);

  // Set up user-game mappings for WebSocket API
  gameData.players.forEach((player) => {
    addUserToGame(player.player_id.toString(), gameId);
  });

  // Remove players from matchmaking room (they'll join gameplay room from frontend)
  const wsManager = getGlobalWebSocketManager();
  gameData.players.forEach((player) => {
    wsManager.removeUserFromRoom(player.player_id.toString(), 'matchmaking');
  });

  console.log(
    `Game ${gameId} instance spawned with ${gameData.players.length} players`,
  );
}

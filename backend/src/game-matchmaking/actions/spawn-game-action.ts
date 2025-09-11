import { getGameCoordinator } from '@/gameplay/game-coordinator';
import { addUserToGame } from '@/gameplay/gameplay-ws-api';
import { getGame } from '@/game/actions/get-game';
// No room management here; action handlers will manage matchmaking room membership

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

  console.log(
    `Game ${gameId} instance spawned with ${gameData.players.length} players`,
  );
}

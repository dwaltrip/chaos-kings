import { getGameCoordinator } from '@/domains/gameplay/game-coordinator';
import { addUserToGame } from '@/domains/gameplay/gameplay-ws-api';
import { getGame } from '@/domains/games/actions';
// No room management here; action handlers will manage matchmaking room membership

export async function spawnGameInstance(gameId: number): Promise<void> {
  console.log(`Spawning game instance for game ${gameId}`);

  // Get game data with players
  const game = await getGame(gameId);
  if (!game) {
    throw new Error(`Game ${gameId} not found when spawning instance`);
  }

  // Add game to coordinator (this creates the GameServer instance)
  const gameCoordinator = getGameCoordinator();
  gameCoordinator.addGame(game);

  // Set up user-game mappings for WebSocket API
  game.players.forEach((player) => {
    addUserToGame(player.user_id, gameId);
  });

  console.log(`Game ${gameId} instance spawned with ${game.players.length} players`);
}

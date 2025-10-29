import { GameId, UserId } from '@kernel/ids';

import { createScopedLogger } from '@/utils/scoped-logger';
import { getGameCoordinator } from '@/domains/gameplay/game-coordinator';
import { registerPlayersForGame } from '@/domains/gameplay/actions';
import { getGame } from '@/domains/games/actions';

const log = createScopedLogger('matchmaking:spawn-game');

async function spawnGameInstance(gameId: GameId): Promise<void> {
  log.debug(`Spawning game instance for game ${gameId}`);

  // Get game data with players
  const game = await getGame(gameId);
  if (!game) {
    throw new Error(`Game ${gameId} not found when spawning instance`);
  }

  // Add game to coordinator (this creates the GameServer instance)
  const gameCoordinator = getGameCoordinator();
  gameCoordinator.addGame(game);

  // Set up user-game mappings
  registerPlayersForGame(
    gameId,
    game.players.map((p) => UserId(p.user_id)),
  );

  log.info(`Game ${gameId} instance spawned with ${game.players.length} players`);
}

export { spawnGameInstance };

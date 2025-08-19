import { Kysely } from 'kysely';

import { PLAYER_COLORS } from '@core/colors';
import { generateRandomMapWithConstraints } from '@core/map/generate-grid';
import { GameConfig } from '@core/game-config';
import { DEFAULT_GAME_GENERATION_CONFIG } from '@core/default-game-config';

import { logger } from '@/utils/logger';
import { GameRepository } from '@/game/game-repository';
import { GamePlayersRepository } from '@/game-players/game-players-repository';
import { GameStatus, Game, NewGame } from '@/game/types';
import { Database } from '@/types';
import { db } from '@/services/db';

async function createGame(
  playerIds: number[],
  dbInstance: Kysely<Database> = db,
): Promise<Game> {
  logger.info(`Creating game with players: ${playerIds.join(', ')}`);
  // Validate player count first
  if (playerIds.length < 2) {
    throw new Error('At least two player IDs are required to create a game.');
  }

  if (playerIds.length > PLAYER_COLORS.length) {
    throw new Error(
      `Too many players. Maximum allowed: ${PLAYER_COLORS.length}`,
    );
  }

  // Check for duplicate player IDs
  const uniquePlayerIds = new Set(playerIds);
  if (uniquePlayerIds.size !== playerIds.length) {
    throw new Error('Duplicate player IDs are not allowed.');
  }

  // Validate that all player IDs exist in the database
  const existingUsers = await dbInstance
    .selectFrom('users')
    .select('id')
    .where('id', 'in', playerIds)
    .execute();

  const existingUserIds = new Set(existingUsers.map((user) => user.id));
  const invalidUserIds = playerIds.filter((id) => !existingUserIds.has(id));

  if (invalidUserIds.length > 0) {
    throw new Error(`Invalid user IDs: ${invalidUserIds.join(', ')}`);
  }

  const playerCount = playerIds.length;

  const { grid, generals } = generateRandomMapWithConstraints(
    DEFAULT_GAME_GENERATION_CONFIG.mapSize,
    playerCount,
    DEFAULT_GAME_GENERATION_CONFIG.minGeneralDistance,
  );

  const playerIndexToColor: GameConfig['playerIndexToColor'] = {};
  for (let i = 0; i < playerCount; i++) {
    // Map player indices (0-based) to colors
    playerIndexToColor[i.toString()] = PLAYER_COLORS[i];
  }

  const newGame: NewGame = {
    game_state: {},
    config: {
      size: DEFAULT_GAME_GENERATION_CONFIG.mapSize,
      startingGrid: grid,
      numPlayers: playerCount,
      playerIndexToColor,
    },
    status: GameStatus.NOT_STARTED,
  };

  const gameRepository = new GameRepository(dbInstance);
  const game = await gameRepository.create(newGame);

  const gamePlayersRepository = new GamePlayersRepository(dbInstance);
  const gamePlayersData = playerIds.map((playerId, index) => ({
    game_id: game.id,
    player_id: playerId,
    player_index: index, // 0-based indexing
  }));

  await gamePlayersRepository.bulkCreate(gamePlayersData);
  return game;
}

export { createGame };

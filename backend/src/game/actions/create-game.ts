import { Kysely } from 'kysely';

import { PLAYER_COLORS } from '@core/colors';
import { generateGameMapV2 } from '@core/terrain-generation';
import { calcMapSizeForPlayers } from '@core/map/calc-map-size';
import { GameConfig } from '@core/game-config';
import { DEFAULT_GAME_GENERATION_CONFIG } from '@core/default-game-config';
import {
  TICK_RATE_MS,
  GENERAL_PRODUCTION_TICKS,
  ARMY_PRODUCTION_TICKS,
} from '@core/game-timing-config';

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
  const dynamicSize = calcMapSizeForPlayers(playerCount);

  const { grid, generals } = generateGameMapV2(
    dynamicSize,
    playerCount,
    DEFAULT_GAME_GENERATION_CONFIG.minGeneralDistance,
    Date.now(), // Use current timestamp as seed for deterministic generation
  );

  const colors: GameConfig['players']['colors'] = Array.from(
    { length: playerCount },
    (_, i) => PLAYER_COLORS[i],
  );

  const newGame: NewGame = {
    game_state: {},
    config: {
      size: dynamicSize,
      startingGrid: grid,
      players: {
        count: playerCount,
        colors,
      },
      generation: {
        seed: Date.now(),
        minGeneralDistance: DEFAULT_GAME_GENERATION_CONFIG.minGeneralDistance,
        mountainDensity: DEFAULT_GAME_GENERATION_CONFIG.mountainDensity,
        // algoVersion: 'v2', // optional for future debugging
      },
      timing: {
        tickRateMs: TICK_RATE_MS,
        generalProductionTicks: GENERAL_PRODUCTION_TICKS,
        armyProductionTicks: ARMY_PRODUCTION_TICKS,
      },
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

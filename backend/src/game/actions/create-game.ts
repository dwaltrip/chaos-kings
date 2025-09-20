import { Kysely } from 'kysely';

import {
  // TODO: TS wasn't complainining when I didn't have `type` here??
  // probably different ts configs in core vs backend vs frontend
  type MapGenerationParams,
  generateGameMapV2,
} from '@core/terrain-generation';
import { DEFAULT_GAME_GENERATION_CONFIG } from '@core/default-game-config';
import {
  TICK_RATE_MS,
  GENERAL_PRODUCTION_TICKS,
  ARMY_PRODUCTION_TICKS,
} from '@core/game-timing-config';
import { isValidForCreateGame } from '@core/game/validation';
import { calcMapSizeForPlayers } from '@core/map/calc-map-size';
import { colorsForPlayerCount } from '@core/colors';

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
  const playerCount = playerIds.length;
  logger.info(
    `Creating game with ${playerCount} players: ${playerIds.join(', ')}`,
  );

  const { valid, errors } = isValidForCreateGame({
    playerCount,
    playerIds: playerIds,
  });
  if (!valid) {
    throw new Error(`Invalid game configuration:\n${errors?.join('\n  -')}`);
  }

  // TODO: Should be fetching via UsersRepository
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

  const mapParams: MapGenerationParams = {
    size: calcMapSizeForPlayers(playerCount),
    numPlayers: playerCount,
    minGeneralDistance: DEFAULT_GAME_GENERATION_CONFIG.minGeneralDistance,
    seed: createMapGenSeed(),
  };
  const { grid } = generateGameMapV2(mapParams, true);

  const newGame: NewGame = {
    game_state: {},
    config: {
      startingGrid: grid,
      playerColors: colorsForPlayerCount(playerCount),
      map: mapParams,
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

// TODO: look into if this is an acceptable way to generate seeds
function createMapGenSeed(): number {
  return Date.now();
}

export { createGame };

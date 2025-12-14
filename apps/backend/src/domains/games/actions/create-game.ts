import { type MapGenerationParams, generateGameMapV2 } from '@core/terrain-generation';
import { DEFAULT_GAME_GENERATION_CONFIG } from '@core/default-game-config';
import {
  TICK_RATE_MS,
  GENERAL_PRODUCTION_TICKS,
  ARMY_PRODUCTION_TICKS,
} from '@core/game-timing-config';
import { GameStatus } from '@core/game/types';
import { isValidForCreateGame } from '@core/game/validation';
import { calcMapSizeForPlayers } from '@core/map/calc-map-size';
import { colorsForPlayerCount } from '@core/colors';

import { logger } from '@/utils/logger';
import { Game, NewGame } from '@/domains/games/types';
import { gameRepository } from '@/domains/games/game-repository';
import { gamePlayersRepository } from '@/domains/games/game-players-repository';
import { userRepository } from '@/domains/users/user-repository';

async function createGame(playerIds: number[]): Promise<Game> {
  const playerCount = playerIds.length;
  logger.info(`Creating game with ${playerCount} players: ${playerIds.join(', ')}`);

  const { valid, errors } = isValidForCreateGame({
    playerCount,
    playerIds: playerIds,
  });
  if (!valid) {
    throw new Error(`Invalid game configuration:\n${errors?.join('\n  -')}`);
  }

  const existingUsers = await userRepository.findByIds(playerIds);
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

  const game = await gameRepository.create(newGame);

  const gamePlayersData = playerIds.map((playerId, index) => ({
    game_id: game.id,
    user_id: playerId,
    player_index: index,
  }));

  await gamePlayersRepository.bulkCreate(gamePlayersData);
  return game;
}

// TODO: look into if this is an acceptable way to generate seeds
function createMapGenSeed(): number {
  return Date.now();
}

export { createGame };

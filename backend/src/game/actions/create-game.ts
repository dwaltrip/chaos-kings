import { Kysely } from 'kysely';

import { invariant } from '@common/utils/invariant';
import { PLAYER_COLORS, PlayerColor } from '@core/colors';
import { generateRandomMap } from '@core/map/generate-grid';
import { GameConfig } from '@core/game-config';
import { DEFAULT_GAME_GENERATION_CONFIG } from '@core/default-game-config';

import { GameRepository } from '@/game/game-repository';
import { GamePlayersRepository } from '@/game-players/game-players-repository';
import { GameStatus, Game, NewGame } from '@/game/types';
import { Database } from '@/types';

interface CreateGameOptions {
  playerIds: number[];
}

async function createGame(options: CreateGameOptions): Promise<Game> {
  const { playerIds = [] } = options;
  const playerCount = Math.max(playerIds.length, 2);
  invariant(
    playerCount <= PLAYER_COLORS.length,
    `Not enough colors for ${playerCount} players`,
  );

  const { grid, generals } = generateRandomMap(
    DEFAULT_GAME_GENERATION_CONFIG.mapSize,
    playerCount,
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

  const gameRepository = new GameRepository();
  const game = await gameRepository.create(newGame);

  if (playerIds.length < 2) {
    throw new Error('At least two player IDs are required to create a game.');
  }

  const gamePlayersRepository = new GamePlayersRepository();
  const gamePlayersData = playerIds.map((playerId, index) => ({
    game_id: game.id,
    player_id: playerId,
    player_index: index, // 0-based indexing
  }));

  await gamePlayersRepository.bulkCreate(gamePlayersData);
  return game;
}

export { createGame };

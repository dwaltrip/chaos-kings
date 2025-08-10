import { Kysely } from 'kysely';

import { invariant } from '@common/utils/invariant';
import { PLAYER_COLORS, PlayerColor } from '@core/colors';
import { generateRandomMap } from '@core/map/generate-grid';
import { GameConfig } from '@core/game-config';

import { GameRepository } from '@/game/game-repository';
import { GamePlayersRepository } from '@/game-players/game-players-repository';
import { GameStatus, Game, NewGame } from '@/game/types';
import { Database } from '@/types';

const DEFAULT_SIZE = { width: 40, height: 40 };

interface CreateGameOptions {
  playerIds: number[];
}

export async function createGame(options: CreateGameOptions): Promise<Game> {
  const { playerIds = [] } = options;
  const playerCount = Math.max(playerIds.length, 2);
  invariant(playerCount <= PLAYER_COLORS.length, `Not enough colors for ${playerCount} players`);
  
  const { grid, generals } = generateRandomMap(DEFAULT_SIZE, playerCount);

  const playerIndexToColor: GameConfig['playerIndexToColor'] = {};
  for (let i = 0; i < playerCount; i++) {
    // Map player indices (1-based) to colors
    playerIndexToColor[(i + 1).toString()] = PLAYER_COLORS[i];
  }
  
  const newGame: NewGame = {
    game_state: {},
    config: {
      size: DEFAULT_SIZE,
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
    player_index: index + 1, // 1-based indexing
  }));
  
  await gamePlayersRepository.bulkCreate(gamePlayersData);
  return game;
}

import { Kysely } from 'kysely';

import { generateRandomMap } from '@core/map/generate-grid';
import { GameRepository } from '@/game/game-repository';
import { GamePlayersRepository } from '@/game-players/game-players-repository';
import { GameStatus, Game, NewGame } from '@/game/types';
import { Database } from '@/types';
import { PLAYER_COLORS } from '@core/colors';

const DEFAULT_SIZE = { width: 40, height: 40 };

interface CreateGameOptions {
  playerIds?: number[];
  dbInstance?: Kysely<Database>;
}

export async function createGame(options: CreateGameOptions = {}): Promise<Game> {
  const { playerIds = [], dbInstance } = options;
  const playerCount = Math.max(playerIds.length, 2);
  
  const { grid, generals } = generateRandomMap(DEFAULT_SIZE, playerCount);
  
  // Create player color mapping (1-based indices)
  const playerColors: Record<string, string> = {};
  for (let i = 0; i < playerCount; i++) {
    const playerIndex = i + 1;
    const colorIndex = i % PLAYER_COLORS.length;
    playerColors[playerIndex.toString()] = PLAYER_COLORS[colorIndex];
  }
  
  const newGame: NewGame = {
    game_state: {},
    config: {
      size: DEFAULT_SIZE,
      startingGrid: grid,
      playerColors,
    },
    status: GameStatus.NOT_STARTED,
  };
  
  const gameRepository = new GameRepository(dbInstance);
  const game = await gameRepository.create(newGame);
  
  // Create game_players records if playerIds provided
  if (playerIds.length > 0) {
    const gamePlayersRepository = new GamePlayersRepository(dbInstance);
    const gamePlayersData = playerIds.map((playerId, index) => ({
      game_id: game.id,
      player_id: playerId,
      player_index: index + 1, // 1-based indexing
    }));
    
    await gamePlayersRepository.bulkCreate(gamePlayersData);
  }
  
  return game;
}

import { GameRepository } from '@/game/game-repository';
import { GameStatus, Game, NewGame } from '@/game/types';
import { Kysely } from 'kysely';
import { Database } from '@/types';

export async function createGame(dbInstance?: Kysely<Database>): Promise<Game> {
  const newGame: NewGame = {
    game_state: {},
    status: GameStatus.NOT_STARTED,
  };

  const gameRepository = new GameRepository(dbInstance);
  return await gameRepository.create(newGame);
}
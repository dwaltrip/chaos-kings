import { GameRepository } from '@/game/game-repository';
import { Game } from '@/game/types';
import { Kysely } from 'kysely';
import { Database } from '@/types';
import { GameWithPlayers } from '@common/types/games';

async function getGame_OLD(id: number, dbInstance?: Kysely<Database>): Promise<Game | null> {
  const gameRepository = new GameRepository(dbInstance);
  return await gameRepository.findById(id);
}

// getGameWithPlayers
async function getGame(id: number, dbInstance?: Kysely<Database>): Promise<GameWithPlayers | null> {
  const gameRepository = new GameRepository(dbInstance);
  return await gameRepository.findByIdWithPlayers(id);
}

// export { getGame, getGameWithPlayers };
export { getGame };

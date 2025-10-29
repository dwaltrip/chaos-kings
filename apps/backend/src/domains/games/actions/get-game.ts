import { Kysely } from 'kysely';

import { GameWithPlayers } from '@common/types/games';
import { Database } from '@/types';
import { Game } from '@/domains/games/types';
import { GameRepository } from '@/domains/games/game-repository';

async function getGame_OLD(
  id: number,
  dbInstance?: Kysely<Database>,
): Promise<Game | null> {
  const gameRepository = new GameRepository(dbInstance);
  return await gameRepository.findById(id);
}

// getGameWithPlayers
async function getGame(
  id: number,
  dbInstance?: Kysely<Database>,
): Promise<GameWithPlayers | null> {
  const gameRepository = new GameRepository(dbInstance);
  return await gameRepository.findByIdWithPlayers(id);
}

// export { getGame, getGameWithPlayers };
export { getGame };

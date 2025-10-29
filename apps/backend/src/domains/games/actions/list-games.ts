import { Kysely } from 'kysely';

import { Database } from '@/types';
import { Game } from '@/domains/games/types';
import { GameRepository, GamePlayer } from '@/domains/games/game-repository';

async function listGames(
  dbInstance?: Kysely<Database>,
): Promise<(Game & { players: GamePlayer[] })[]> {
  const gameRepository = new GameRepository(dbInstance);
  return await gameRepository.findAll();
}

export { listGames };

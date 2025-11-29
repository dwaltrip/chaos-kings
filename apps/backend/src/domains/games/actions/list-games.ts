import { Kysely } from 'kysely';

import { Database } from '@/types';
import { Game } from '@/domains/games/types';
import {
  gameRepository,
  createGameRepository,
  GamePlayer,
} from '@/domains/games/game-repository';

async function listGames(
  dbInstance?: Kysely<Database>,
): Promise<(Game & { players: GamePlayer[] })[]> {
  const repo = dbInstance ? createGameRepository(dbInstance) : gameRepository;
  return await repo.findAll();
}

export { listGames };

import { Kysely } from 'kysely';
import { GameId } from '@kernel/ids';
import { GameWithPlayers } from '@platform/domains/games/types';

import { Database } from '@/types';
import {
  gameRepository,
  createGameRepository,
} from '@/domains/games/game-repository';

async function getGame(
  id: GameId,
  dbInstance?: Kysely<Database>,
): Promise<GameWithPlayers | null> {
  const repo = dbInstance ? createGameRepository(dbInstance) : gameRepository;
  return await repo.findByIdWithPlayers(id);
}

export { getGame };

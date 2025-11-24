import { Kysely } from 'kysely';
import { GameId } from '@kernel/ids';
import { GameWithPlayers } from '@platform/domains/games/types';

import { Database } from '@/types';
import { GameRepository } from '@/domains/games/game-repository';

async function getGame(
  id: GameId,
  dbInstance?: Kysely<Database>,
): Promise<GameWithPlayers | null> {
  const gameRepository = new GameRepository(dbInstance);
  return await gameRepository.findByIdWithPlayers(id);
}

export { getGame };

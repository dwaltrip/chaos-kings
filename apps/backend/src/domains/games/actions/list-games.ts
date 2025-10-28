import { GameRepository, GamePlayer } from '@/game/game-repository';
import { Game } from '@/game/types';
import { Kysely } from 'kysely';
import { Database } from '@/types';

async function listGames(
  dbInstance?: Kysely<Database>,
): Promise<(Game & { players: GamePlayer[] })[]> {
  const gameRepository = new GameRepository(dbInstance);
  return await gameRepository.findAll();
}

export { listGames };

import { GameRepository } from '@/game/game-repository';
import { Game } from '@/game/types';
import { Kysely } from 'kysely';
import { Database } from '@/types';

export async function listGames(dbInstance?: Kysely<Database>): Promise<Game[]> {
  const gameRepository = new GameRepository(dbInstance);
  return await gameRepository.findAll();
}
import { GameRepository } from '@/game/game-repository';
import { Game } from '@/game/types';
import { Kysely } from 'kysely';
import { Database } from '@/types';

export async function getGame(id: number, dbInstance?: Kysely<Database>): Promise<Game | null> {
  const gameRepository = new GameRepository(dbInstance);
  return await gameRepository.findById(id);
}
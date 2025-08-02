import { db } from '@/services/db';
import { GamesTable } from '@/game/game.db';
import { Game, NewGame } from '@/game/types';
import { Kysely } from 'kysely';
import { Database } from '@/types';

class GameRepository {
  constructor(private dbInstance: Kysely<Database> = db) {}

  async findAll(): Promise<Game[]> {
    const games = await this.dbInstance
      .selectFrom('games')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();

    return games;
  }

  async findById(id: number): Promise<Game | null> {
    const game = await this.dbInstance
      .selectFrom('games')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return game || null;
  }

  async create(gameData: NewGame): Promise<Game> {
    const game = await this.dbInstance
      .insertInto('games')
      .values(gameData)
      .returningAll()
      .executeTakeFirstOrThrow();

    return game;
  }
}

export { GameRepository };
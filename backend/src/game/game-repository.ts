import { db } from '@/services/db';
import { GamesTable } from '@/game/game.db';
import { Game, NewGame } from '@/game/types';
import { GamePlayer } from '@/game-players/game-players-repository';
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

  async findByIdWithPlayers(id: number): Promise<(Game & { players: GamePlayer[] }) | null> {
    const game = await this.dbInstance
      .selectFrom('games')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!game) {
      return null;
    }

    const players = await this.dbInstance
      .selectFrom('game_players')
      .innerJoin('users', 'users.id', 'game_players.player_id')
      .select([
        'game_players.id',
        'game_players.game_id',
        'game_players.player_id',
        'game_players.joined_at',
        'game_players.status',
        'game_players.player_index',
        'game_players.data',
        'users.username',
      ])
      .where('game_players.game_id', '=', id)
      .orderBy('game_players.player_index', 'asc')
      .execute();

    return {
      ...game,
      players: players as GamePlayer[],
    };
  }
}

export { GameRepository };

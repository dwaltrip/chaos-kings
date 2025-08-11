import { db } from '@/services/db';
import { GamePlayersTable, GamePlayerStatus } from '@/game-players/game-players.db';
import { Kysely, Selectable, Insertable } from 'kysely';
import { Database } from '@/types';

type GamePlayer = Selectable<GamePlayersTable>;
type NewGamePlayer = Insertable<GamePlayersTable>;

interface CreateGamePlayerData {
  game_id: number;
  player_id: number;
  player_index: number;
  status?: GamePlayerStatus;
  data?: object;
}

class GamePlayersRepository {
  constructor(private dbInstance: Kysely<Database> = db) {}

  async findByGameId(gameId: number): Promise<GamePlayer[]> {
    const players = await this.dbInstance
      .selectFrom('game_players')
      .selectAll()
      .where('game_id', '=', gameId)
      .orderBy('player_index', 'asc')
      .execute();

    return players;
  }

  async createGamePlayer(data: CreateGamePlayerData): Promise<GamePlayer> {
    const gamePlayerData: NewGamePlayer = {
      game_id: data.game_id,
      player_id: data.player_id,
      player_index: data.player_index,
      status: data.status || 'active',
      data: data.data || null,
    };

    const gamePlayer = await this.dbInstance
      .insertInto('game_players')
      .values(gamePlayerData)
      .returningAll()
      .executeTakeFirstOrThrow();

    return gamePlayer;
  }

  async bulkCreate(players: CreateGamePlayerData[]): Promise<GamePlayer[]> {
    const gamePlayersData: NewGamePlayer[] = players.map(data => ({
      game_id: data.game_id,
      player_id: data.player_id,
      player_index: data.player_index,
      status: data.status || 'active',
      data: data.data || null,
    }));

    const gamePlayers = await this.dbInstance
      .insertInto('game_players')
      .values(gamePlayersData)
      .returningAll()
      .execute();

    return gamePlayers;
  }
}

export { GamePlayersRepository, GamePlayer, NewGamePlayer, CreateGamePlayerData };


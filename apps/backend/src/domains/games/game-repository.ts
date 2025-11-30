import { GameId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';

import { BaseRepository } from '@/utils/base-repository';
import { DBGame, Game, NewGame } from '@/domains/games/types';
import { GamePlayer } from '@/domains/games/game-players-repository';

class GameRepository extends BaseRepository {
  async findAll(): Promise<(Game & { players: GamePlayer[] })[]> {
    const games = await this.db
      .selectFrom('games')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();

    const gamesWithPlayers = await Promise.all(
      games.map(async (game) => {
        const players = await this.playersForGameIdQuery(GameId(game.id));
        return {
          ...deserializeGame(game),
          players: players as GamePlayer[],
        };
      }),
    );
    return gamesWithPlayers;
  }

  async findById(id: GameId): Promise<Game | null> {
    const game = await this.db
      .selectFrom('games')
      .selectAll()
      .where('id', '=', idToNumber(id))
      .executeTakeFirst();

    return deserializeGameOrNull(game);
  }

  async create(gameData: NewGame): Promise<Game> {
    const game = await this.db
      .insertInto('games')
      .values(gameData)
      .returningAll()
      .executeTakeFirstOrThrow();

    return deserializeGame(game);
  }

  async findByIdWithPlayers(
    id: GameId,
  ): Promise<(Game & { players: GamePlayer[] }) | null> {
    const game = await this.db
      .selectFrom('games')
      .selectAll()
      .where('id', '=', idToNumber(id))
      .executeTakeFirst();

    if (!game) {
      return null;
    }

    const players = await this.playersForGameIdQuery(id);
    return {
      ...deserializeGame(game),
      players: players as GamePlayer[],
    };
  }

  async updateStatus(id: GameId, status: string): Promise<void> {
    await this.db
      .updateTable('games')
      .set({ status })
      .where('id', '=', idToNumber(id))
      .execute();
  }

  async updateMoveHistory(id: GameId, moveHistory: object): Promise<void> {
    await this.db
      .updateTable('games')
      .set({ move_history: moveHistory })
      .where('id', '=', idToNumber(id))
      .execute();
  }

  async updateStatusGameStateAndMoveHistory(
    id: GameId,
    status: string,
    gameState: object,
    moveHistory: object,
  ): Promise<void> {
    await this.db
      .updateTable('games')
      .set({ status, game_state: gameState, move_history: moveHistory })
      .where('id', '=', idToNumber(id))
      .execute();
  }

  private async playersForGameIdQuery(id: GameId) {
    return await this.db
      .selectFrom('game_players')
      .innerJoin('users', 'users.id', 'game_players.user_id')
      .select([
        'game_players.id',
        'game_players.game_id',
        'game_players.user_id',
        'game_players.joined_at',
        'game_players.status',
        'game_players.player_index',
        'game_players.data',
        'users.username',
      ])
      .where('game_players.game_id', '=', id)
      .orderBy('game_players.player_index', 'asc')
      .execute();
  }
}

function deserializeGameOrNull(game: DBGame | undefined): Game | null {
  if (!game) {
    return null;
  }
  return deserializeGame(game);
}

// TODO: where should code like this go?
// what patterns should we use for serialization/deserialization,
// assembling rich domain models, etc.?
// ---
// TODO: this isn't exactly serialization/deserialization,
function deserializeGame(game: DBGame): Game {
  return {
    ...game,
    id: GameId(game.id),
  };
}

const gameRepository = new GameRepository();

export { gameRepository, GamePlayer };

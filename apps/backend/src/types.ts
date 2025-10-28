// https://kysely.dev/docs/getting-started#types

import { UsersTable } from '@/domains/users/user.db';
import { GamesTable } from '@/domains/games/game.db';
import { GamePlayersTable } from '@/domains/games/game-players.db';

interface Database {
  users: UsersTable;
  games: GamesTable;
  game_players: GamePlayersTable;
}

export { Database, UsersTable, GamesTable, GamePlayersTable };

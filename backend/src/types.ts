// https://kysely.dev/docs/getting-started#types

import { UsersTable } from '@/user/user.db';
import { GamesTable } from '@/game/game.db';
import { GamePlayersTable } from '@/game-players/game-players.db';

interface Database {
  users: UsersTable
  games: GamesTable
  game_players: GamePlayersTable
}

export {
  Database,
  UsersTable,
  GamesTable,
  GamePlayersTable,
};

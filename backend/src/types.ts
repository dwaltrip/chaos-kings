// https://kysely.dev/docs/getting-started#types

import { UsersTable } from '@/user/user.db';
import { GamesTable } from '@/game/game.db';

interface Database {
  users: UsersTable
  games: GamesTable
}

export {
  Database,
  UsersTable,
  GamesTable,
};

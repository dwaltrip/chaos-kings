// https://kysely.dev/docs/getting-started#types

import {
  ColumnType,
  Generated,
  Insertable,
  // JSONColumnType,
  Selectable,
  Updateable,
} from 'kysely';

interface Database {
  users: UsersTable
}

interface UsersTable {
  id: Generated<number>
  username: string
  created_at: ColumnType<Date, string | undefined, never>
}

type User = Selectable<UsersTable>
type NewUser = Insertable<UsersTable>
type UserUpdate = Updateable<UsersTable>

export {
  Database,
  UsersTable,
  User,
  NewUser,
  UserUpdate,
};

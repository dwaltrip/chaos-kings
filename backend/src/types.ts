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
  user: UserTable
}

interface UserTable {
  id: Generated<number>
  username: string
  created_at: ColumnType<Date, string | undefined, never>
}

type User = Selectable<UserTable>
type NewUser = Insertable<UserTable>
type UserUpdate = Updateable<UserTable>

export {
  Database,
  UserTable,
  User,
  NewUser,
  UserUpdate,
};

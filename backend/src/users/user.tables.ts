import {
  ColumnType,
  Generated,
} from 'kysely';

interface UsersTable {
  id: Generated<number>
  username: string
  created_at: ColumnType<Date, string | undefined, never>
}

export {
  UsersTable,
};
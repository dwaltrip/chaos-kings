import {
  ColumnType,
  Generated,
} from 'kysely';

interface GamesTable {
  id: Generated<number>
  game_state: object
  // TODO: use an enum for status
  status: string
  created_at: ColumnType<Date, string | undefined, never>
  updated_at: ColumnType<Date, string | undefined, never>
}

export {
  GamesTable,
};

import { ColumnType, Generated } from 'kysely';

// TODO: how people using Kysely ensure this matches the actual DB schema?
// (see matching comment in src/types.ts)
interface GameChatMessagesTable {
  id: Generated<number>;
  content: string;
  // TODO: Fix other timestamp types to use these types for created / updated at
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  user_id: number;
  game_id: number;
}

export { GameChatMessagesTable };

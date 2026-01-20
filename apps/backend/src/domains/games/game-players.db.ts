import { ColumnType, Generated } from 'kysely';

// TODO: status column is not used - always 'active'. Consider removing from DB schema.
type GamePlayerStatus = 'active' | 'captured' | 'inactive';

interface GamePlayersTable {
  id: Generated<number>;
  game_id: number;
  user_id: number;
  joined_at: ColumnType<Date, string | undefined, never>;
  status: GamePlayerStatus;
  player_index: number;
  data: object | null;
}

export { GamePlayersTable, GamePlayerStatus };

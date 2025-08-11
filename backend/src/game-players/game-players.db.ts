import {
  ColumnType,
  Generated,
} from 'kysely';

type GamePlayerStatus = 'active' | 'captured' | 'inactive';

interface GamePlayersTable {
  id: Generated<number>
  game_id: number
  player_id: number
  joined_at: ColumnType<Date, string | undefined, never>
  status: GamePlayerStatus
  player_index: number
  data: object | null
}

export {
  GamePlayersTable,
  GamePlayerStatus,
};


import { GameConfig } from '@core/game-config';
import { ColumnType, Generated } from 'kysely';

interface GamesTable {
  id: Generated<number>;
  game_state: object;
  config: GameConfig;
  move_history: object | null;
  // TODO: use an enum for status
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export { GamesTable };

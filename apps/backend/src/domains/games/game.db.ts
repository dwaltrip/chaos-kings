import { ColumnType, Generated } from 'kysely';

import { GameConfig } from '@core/game-config';
import { CompletedGameState } from '@core/types';

interface GamesTable {
  id: Generated<number>;
  game_state: {} | CompletedGameState;
  config: GameConfig;
  move_history: object | null;
  // TODO: use an enum for status
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export { GamesTable };

// import { GameConfig } from '@core/game-config';
import type { PlayerIndex } from '@core/types';

interface Player {
  id: number;
  game_id: number;
  user_id: number;
  joined_at: Date | string | undefined;
  status: string; // GamePlayerStatus
  player_index: PlayerIndex;
  data: object | null;
}

export type { Player };

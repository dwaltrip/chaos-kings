// ----------------------------------------------------------------------------
// NOTE: This was moved from @common to @platform so we could finishing
// deleting common entirely. I didn't really refactor these types yet.
//
// TODO: Look into refactoring these types. Probably something like DB entities
// vs. types specific the the backend and frontend apps.
//
// The contents of this were from:
//   - common/types/games.ts
//   - common/types/gameplay.ts
//   - common/types/player.ts
// ----------------------------------------------------------------------------

import { GameStatus, type Game } from '@core/game/types';
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

interface GameWithPlayers extends Game {
  players: Player[];
}

export { GameStatus };

export type { Game, GameWithPlayers, Player };

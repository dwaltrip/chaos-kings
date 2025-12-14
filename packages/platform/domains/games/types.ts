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

import { type Game } from '@core/game/types';
import type { PlayerIndex } from '@core/types';

type GamePlayerStatus = 'active' | 'captured' | 'inactive';

interface Player {
  id: number;
  game_id: number;
  user_id: number;
  joined_at: Date | string | undefined;
  status: GamePlayerStatus;
  player_index: PlayerIndex;
  data: object | null;
  username: string;
}

interface GameWithPlayers extends Game {
  players: Player[];
}

export type { Game, GameWithPlayers, Player, GamePlayerStatus };

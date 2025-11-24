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

interface CreateGameRequest {
  // Empty for now, may add game options later
}

interface CreateGameResponse {
  game: Game;
}

interface ListGamesResponse {
  games: GameWithPlayers[];
}

interface GetGameResponse {
  game: GameWithPlayers;
}

export { GameStatus };

export type {
  Game,
  GameWithPlayers,
  CreateGameRequest,
  CreateGameResponse,
  ListGamesResponse,
  GetGameResponse,
  Player,
};

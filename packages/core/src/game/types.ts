import type { GameConfig } from '@core/game-config';
import type { CompletedGameState } from '@core/types';

// TODO: this is duplicated on backend.
// Also all of this should be in core.
// I want common to be game-agnostic
const GameStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
} as const;
type GameStatusType = (typeof GameStatus)[keyof typeof GameStatus];

// -----------------------------------------------------------
// TODO: this is duplicate w/ GamesTable interface in backend.
// -----------------------------------------------------------
interface Game {
  id: number;
  game_state: {} | CompletedGameState;
  config: GameConfig;
  move_history: object | null;
  status: string;
  // TODO: I don't like having these as possibly Date or string
  created_at: Date | string;
  updated_at: Date | string;
}

export type { Game, GameStatusType };

export { GameStatus };

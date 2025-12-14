import type { GameConfig } from '@core/game-config';
import type { CompletedGameState } from '@core/types';

const GameStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
} as const;
type GameStatusType = (typeof GameStatus)[keyof typeof GameStatus];

function validateGameStatus(value: string): GameStatusType {
  const validStatuses: readonly GameStatusType[] = Object.values(GameStatus);
  if (validStatuses.includes(value as GameStatusType)) {
    return value as GameStatusType;
  }
  // TODO: validation error type
  throw new Error(`Invalid GameStatusType: ${value}`);
}

// -----------------------------------------------------------
// TODO: this is duplicate w/ GamesTable interface in backend.
// -----------------------------------------------------------
interface Game {
  id: number;
  game_state: {} | CompletedGameState;
  config: GameConfig;
  move_history: object | null;
  status: GameStatusType;
  // TODO: I don't like having these as possibly Date or string
  created_at: Date | string;
  updated_at: Date | string;
}

export type { Game, GameStatusType };

export { GameStatus, validateGameStatus };

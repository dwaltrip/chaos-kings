import type { GameConfig } from '@core/game-config';
import type { CompletedGameState } from '@core/types';

const GameStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED_TO_START: 'failed_to_start',
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
// TODO: Revisit naming and patterns
// CoreGameAttrs: Base attributes for extension - not meant to be used directly
// AbstractGame: Type for core game functions - currently an alias but semantically different
// -----------------------------------------------------------
interface CoreGameAttrs {
  game_state: {} | CompletedGameState;
  config: GameConfig;
  move_history: object | null;
  status: GameStatusType;
}

type AbstractGame = CoreGameAttrs;

export type { CoreGameAttrs, AbstractGame, GameStatusType };

export { GameStatus, validateGameStatus };

import type { Player } from '@common/types/player';
import type { GameConfig } from '@core/game-config';
import type { CompletedGameState } from '@core/types';

const GameStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
} as const;

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
};

const GameStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete'
} as const;

interface Game {
  id: number;
  game_state: object;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CreateGameRequest {
  // Empty for now, may add game options later
}

interface CreateGameResponse {
  game: Game;
}

interface ListGamesResponse {
  games: Game[];
}

interface GetGameResponse {
  game: Game;
}

export {
  GameStatus,
};

export type {
  Game,
  CreateGameRequest,
  CreateGameResponse,
  ListGamesResponse,
  GetGameResponse,
};
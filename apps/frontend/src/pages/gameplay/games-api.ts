import type { GameWithPlayers, GetGameResponse } from '@common/types/games';
import { apiService } from '@/services/api-service';

class GameNotFoundError extends Error {
  constructor(gameId: string) {
    super(`Game with ID ${gameId} not found`);
    this.name = 'GameNotFoundError';
  }
}

class GameApiError extends Error {
  public statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'GameApiError';
    this.statusCode = statusCode;
  }
}

async function loadGame(gameId: string): Promise<GameWithPlayers> {
  try {
    const response = await apiService.get(`/api/games/${gameId}`);

    if (response.status === 404) {
      throw new GameNotFoundError(gameId);
    }

    if (!response.ok) {
      throw new GameApiError(
        `Failed to load game: ${response.statusText}`,
        response.status,
      );
    }

    const data: GetGameResponse = await response.json();
    return data.game;
  } catch (error) {
    if (error instanceof GameNotFoundError || error instanceof GameApiError) {
      throw error;
    }

    throw new GameApiError('Failed to load game due to network or parsing error');
  }
}

export { GameNotFoundError, GameApiError, loadGame };

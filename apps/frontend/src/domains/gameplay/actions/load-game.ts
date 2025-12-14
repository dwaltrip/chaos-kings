import { loadGame as apiLoadGame } from '@/domains/games/games-api';
import type { GameId } from '@kernel/ids';
import type { GameWithPlayers } from '@platform/domains/games/types';

async function loadGame(gameId: GameId): Promise<GameWithPlayers> {
  return await apiLoadGame(gameId);
}

export { loadGame };

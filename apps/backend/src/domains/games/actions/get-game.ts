import { GameId } from '@kernel/ids';
import { GameWithPlayers } from '@platform/domains/games/types';

import { gameRepository } from '@/domains/games/game-repository';

async function getGame(id: GameId): Promise<GameWithPlayers | null> {
  return await gameRepository.findByIdWithPlayers(id);
}

export { getGame };

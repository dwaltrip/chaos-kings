import type { Player } from '@platform/domains/games/types';

import { Game } from '@/domains/games/types';
import { gameRepository } from '@/domains/games/game-repository';

async function listGames(): Promise<(Game & { players: Player[] })[]> {
  return await gameRepository.findAll();
}

export { listGames };

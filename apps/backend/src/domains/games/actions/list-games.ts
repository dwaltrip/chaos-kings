import { Game } from '@/domains/games/types';
import { gameRepository, GamePlayer } from '@/domains/games/game-repository';

async function listGames(): Promise<(Game & { players: GamePlayer[] })[]> {
  return await gameRepository.findAll();
}

export { listGames };

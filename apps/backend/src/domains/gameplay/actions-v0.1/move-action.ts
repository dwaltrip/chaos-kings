import type { Coord, Direction } from '@core/types';
import { getGameCoordinator } from '../game-coordinator';
import { getUserGame } from './user-game-mapping';

export async function queueMove(
  userId: number,
  sourceCoord: Coord,
  direction: Direction,
): Promise<void> {
  const gameId = getUserGame(userId);

  if (!gameId) {
    console.log(`[GameplayActions] User ${userId} not in any active game`);
    return;
  }

  const gameCoordinator = getGameCoordinator();
  const gameServer = gameCoordinator.getGame(gameId);

  if (!gameServer) {
    console.log(`[GameplayActions] Game ${gameId} not found for user ${userId}`);
    return;
  }

  gameServer.queueMove(userId, sourceCoord, direction);
}

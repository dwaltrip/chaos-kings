import type { Coord, Direction } from '@core/types';
import { UserId } from '@kernel/ids';

import { createScopedLogger } from '@/utils/scoped-logger';
import { getGameCoordinator } from '@/domains/gameplay/game-coordinator';

import { getUserGame } from './user-game-mapping';

const log = createScopedLogger('gameplay:queue-move');

async function queueMove(
  userId: UserId,
  sourceCoord: Coord,
  direction: Direction,
): Promise<void> {
  const gameId = getUserGame(userId);

  if (!gameId) {
    log.debug(`User ${userId} not in any active game`);
    return;
  }

  const gameCoordinator = getGameCoordinator();
  const gameServer = gameCoordinator.getGame(gameId);

  if (!gameServer) {
    log.warn(`Game ${gameId} not found for user ${userId}`);
    return;
  }

  gameServer.queueMove(userId, sourceCoord, direction);
}

export { queueMove };

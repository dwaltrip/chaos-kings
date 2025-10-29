import { UserId } from '@kernel/ids';

import { createScopedLogger } from '@/utils/scoped-logger';
import { getGameCoordinator } from '@/domains/gameplay/game-coordinator';

import { getUserGame } from './user-game-mapping';

const log = createScopedLogger('gameplay:cancel-moves');

async function cancelQueuedMoves(userId: UserId): Promise<void> {
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

  gameServer.clearMoves(userId);
}

export { cancelQueuedMoves };

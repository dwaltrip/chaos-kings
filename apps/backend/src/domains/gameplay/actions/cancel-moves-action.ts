import { UserId } from '@kernel/ids';

import { createScopedLogger } from '@/utils/scoped-logger';
import { getGameCoordinator } from '@/domains/gameplay/game-coordinator';

const log = createScopedLogger('gameplay:cancel-moves');

function cancelQueuedMoves(userId: UserId): void {
  const ctx = getGameCoordinator().getGameContextForUser(userId);
  if (!ctx) {
    log.debug(`User ${userId} not in any active game`);
    return;
  }

  ctx.gameServer.clearMoves(ctx.playerIndex);
}

export { cancelQueuedMoves };

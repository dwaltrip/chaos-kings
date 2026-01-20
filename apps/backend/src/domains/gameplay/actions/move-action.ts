import type { Coord, Direction } from '@core/types';
import { UserId } from '@kernel/ids';

import { createScopedLogger } from '@/utils/scoped-logger';
import { getGameCoordinator } from '@/domains/gameplay/game-coordinator';

const log = createScopedLogger('gameplay:queue-move');

function queueMove(userId: UserId, sourceCoord: Coord, direction: Direction): void {
  const ctx = getGameCoordinator().getGameContextForUser(userId);
  if (!ctx) {
    log.debug(`User ${userId} not in any active game`);
    return;
  }

  ctx.gameServer.queueMove(ctx.playerIndex, sourceCoord, direction);
}

export { queueMove };

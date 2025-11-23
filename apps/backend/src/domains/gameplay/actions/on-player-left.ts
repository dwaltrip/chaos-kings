import { GameId, UserId } from '@kernel/ids';
import { buildGameRoomId } from '@platform/domains/gameplay/helpers';

import { createScopedLogger } from '@/utils/scoped-logger';
import type { ConnectionId } from '@/ws-lib/types';
import { systemActions } from '@/domains/system/actions';

const log = createScopedLogger('gameplay:on-player-left');

// TODO: Feels slightly off passing socket connectionId into gameplay action
// Consider if there's a cleaner way to coordinate system transport + gameplay logic
function onPlayerLeft(gameId: GameId, userId: UserId, connectionId: ConnectionId): void {
  // TODO: Implement GameServer.onPlayerLeftRoom
  // Should remove from connectedPlayers set, maybe cancel countdown, clear move queue
  log.debug(`Player ${userId} left game ${gameId} (cleanup deferred)`);

  const roomId = buildGameRoomId(gameId);
  systemActions.leaveRoom({ roomId, userId, connectionId });
}

export { onPlayerLeft };

import { GameId, UserId } from '@kernel/ids';
import { makeRoomId } from '@protocol/domains/system';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import { buildGameRoomId } from '@platform/domains/gameplay/helpers';

import { createScopedLogger } from '@/utils/scoped-logger';
import type { ConnectionId } from '@/ws-lib/types';
import { getGameCoordinator } from '@/domains/gameplay/game-coordinator';
import { systemActions } from '@/domains/system/actions';

const log = createScopedLogger('gameplay:on-player-joined');

// TODO: Feels slightly off passing socket connectionId into gameplay action
// Consider if there's a cleaner way to coordinate system transport + gameplay logic
function onPlayerJoined(
  gameId: GameId,
  userId: UserId,
  connectionId: ConnectionId,
): void {
  // Handle transport (system domain)
  const roomId = makeRoomId(GAMEPLAY_DOMAIN, buildGameRoomId(gameId));
  systemActions.joinRoom({ roomId, userId, connectionId });

  // Handle game logic (gameplay domain)
  const gameCoordinator = getGameCoordinator();
  const gameServer = gameCoordinator.getGame(gameId);

  if (!gameServer) {
    log.warn(`Game ${gameId} not found when player ${userId} joined`);
    return;
  }

  gameServer.onPlayerJoinedRoom(userId);
  log.debug(`Player ${userId} joined game ${gameId}`);
}

export { onPlayerJoined };

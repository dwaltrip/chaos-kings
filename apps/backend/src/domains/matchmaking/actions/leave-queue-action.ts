import { UserId } from '@kernel/ids';
import { MATCHMAKING_ROOM_ID } from '@platform/domains/matchmaking/constants';

import type { ConnectionId } from '@/ws-lib/types';
import { systemActions } from '@/domains/system/actions';
import { getMatchmakingService } from '@/domains/matchmaking/matchmaking-service';
import { broadcastMatchmakingStatus } from '@/domains/matchmaking/actions/broadcast-matchmaking-status';

export async function leaveQueue(
  userId: UserId,
  connectionId: ConnectionId,
): Promise<void> {
  const matchmakingService = await getMatchmakingService();
  await matchmakingService.removePlayer(userId);

  await broadcastMatchmakingStatus();

  // Leave matchmaking room
  systemActions.leaveRoom({ roomId: MATCHMAKING_ROOM_ID, userId, connectionId });
}

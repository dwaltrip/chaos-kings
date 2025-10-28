import { UserId } from '@kernel/ids';
import { MATCHMAKING_ROOM_ID } from '@platform/domains/matchmaking/constants';

import type { ConnectionId } from '@/ws-lib/types';
import { systemActions } from '@/domains/system/actions';
import { getMatchmakingService } from '@/domains/matchmaking/matchmaking-service';
import { handleGameSpawn } from '@/domains/matchmaking/actions/handle-game-spawn';
import { broadcastMatchmakingStatus } from '@/domains/matchmaking/actions/broadcast-matchmaking-status';

export async function joinQueue(
  userId: UserId,
  connectionId: ConnectionId,
): Promise<void> {
  // Join matchmaking room
  systemActions.joinRoom({ roomId: MATCHMAKING_ROOM_ID, userId, connectionId });

  const matchmakingService = await getMatchmakingService();
  const game = await matchmakingService.addPlayer(userId);

  if (game) {
    await handleGameSpawn(game);
  }

  await broadcastMatchmakingStatus();
}

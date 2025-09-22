import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import { WsActions } from '@/websocket/types';

export async function leaveQueue(
  userId: number,
  wsActions: WsActions,
): Promise<void> {
  const matchmakingService = await getMatchmakingService();
  await matchmakingService.removePlayer(userId);

  const queueStatus = await matchmakingService.getQueueStatus();
  wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'queue-status',
    payload: {
      queueSize: queueStatus.queueSize,
      playersNeeded: queueStatus.playersNeeded,
    },
  });

  // Broadcast early-start status after leave (votes reset on membership change)
  const earlyStatus = await matchmakingService.getEarlyStartStatus();
  wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'early-start-status',
    payload: earlyStatus,
  });
}

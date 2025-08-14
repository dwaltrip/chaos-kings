import {
  GameMatchmaking,
  GAME_MATCHMAKING_DOMAIN,
} from '@common/types/game-matchmaking';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import { WsActions } from '@/websocket/types';

export async function handleLeaveQueue(
  data: GameMatchmaking.LeaveQueueMessage,
  wsActions: WsActions,
): Promise<void> {
  if (!data.user) {
    console.error('No user data in leave-queue message');
    return;
  }

  const matchmakingService = await getMatchmakingService();
  await matchmakingService.removePlayer(data.user.id);

  const queueStatus = await matchmakingService.getQueueStatus();
  wsActions.broadcastToRoom(MATCHMAKING_ROOM_NAME, {
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'queue-status',
    payload: {
      queueSize: queueStatus.queueSize,
      playersNeeded: queueStatus.playersNeeded,
    },
  });
}

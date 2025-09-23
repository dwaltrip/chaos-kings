import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import { ClientWsActions } from '@/websocket/types';

export async function sendQueueStatusToSelf(
  wsActions: ClientWsActions,
): Promise<void> {
  const matchmakingService = await getMatchmakingService();
  const queueStatus = await matchmakingService.getQueueStatus();

  wsActions.reply({
    domain: GAME_MATCHMAKING_DOMAIN,
    type: 'queue-status',
    payload: {
      queueSize: queueStatus.queueSize,
      playersNeeded: queueStatus.playersNeeded,
    },
  });
}

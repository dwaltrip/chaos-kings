import { GAME_MATCHMAKING_DOMAIN } from '@common/types/game-matchmaking';
import { MATCHMAKING_ROOM_NAME } from '@common/constants/matchmaking';
import { getMatchmakingService } from '@/game-matchmaking/matchmaking-service';
import type { GameMatchmakingEffects } from '@/game-matchmaking/ws-effects';

export async function leaveQueue(
  userId: number,
  effects: GameMatchmakingEffects,
): Promise<void> {
  const matchmakingService = await getMatchmakingService();
  await matchmakingService.removePlayer(String(userId));

  const queueStatus = await matchmakingService.getQueueStatus();
  effects.broadcastQueueStatus(queueStatus.queueSize, queueStatus.playersNeeded);

  // Broadcast early-start status after leave (votes reset on membership change)
  const earlyStatus = await matchmakingService.getEarlyStartStatus();
  effects.broadcastEarlyStartStatus(earlyStatus);
}

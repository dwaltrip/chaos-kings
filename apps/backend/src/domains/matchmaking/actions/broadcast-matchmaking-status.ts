import { getMatchmakingService } from '@/domains/matchmaking/matchmaking-service';
import { matchmakingWsEffects } from '@/domains/matchmaking/ws-effects';

// TODO: combine status updates into single message type?
async function broadcastMatchmakingStatus(): Promise<void> {
  const matchmakingService = await getMatchmakingService();

  // Broadcast queue status
  const qs = await matchmakingService.getQueueStatus();
  matchmakingWsEffects.broadcastQueueStatus(qs.queueSize, qs.playersNeeded);

  // Broadcast early-start status
  const ess = await matchmakingService.getEarlyStartStatus();
  matchmakingWsEffects.broadcastEarlyStartStatus(ess.voters, ess.queueSize, ess.allVoted);
}

export { broadcastMatchmakingStatus };

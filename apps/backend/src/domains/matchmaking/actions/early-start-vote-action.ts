import { UserId } from '@kernel/ids';

import { getMatchmakingService } from '@/domains/matchmaking/matchmaking-service';
import { handleGameSpawn } from '@/domains/matchmaking/actions/handle-game-spawn';
import { broadcastMatchmakingStatus } from '@/domains/matchmaking/actions/broadcast-matchmaking-status';

export async function earlyStartVote(vote: boolean, userId: UserId): Promise<void> {
  const matchmakingService = await getMatchmakingService();
  await matchmakingService.setEarlyStartVote(userId, vote);

  // Check if this triggers a match (unanimous >= 2) or full lobby
  const game = await matchmakingService.checkForMatch();
  if (game) {
    await handleGameSpawn(game);
  }

  await broadcastMatchmakingStatus();
}

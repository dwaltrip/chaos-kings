import { Gameplay } from '@common/types/gameplay';
import { getGameCoordinator } from '../game-coordinator';
import { getUserGame } from './user-game-mapping';

export async function handleMoveRequest(data: Gameplay.MoveRequest): Promise<void> {
  if (!data.user) {
    console.error('[GameplayActions] No user data in move-request message');
    return;
  }

  const userId = data.user.id.toString();
  const gameId = getUserGame(userId);
  
  if (!gameId) {
    console.log(`[GameplayActions] User ${userId} not in any active game`);
    return;
  }

  const gameCoordinator = getGameCoordinator();
  const gameServer = gameCoordinator.getGame(gameId);
  
  if (!gameServer) {
    console.log(`[GameplayActions] Game ${gameId} not found for user ${userId}`);
    return;
  }

  gameServer.queueMove(userId, data.payload.direction, data.payload.fromCoord);
}
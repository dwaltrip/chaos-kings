import { Gameplay } from '@common/types/gameplay';
import { getGameCoordinator } from '../game-coordinator';
import { getUserGame } from './user-game-mapping';

export async function handleCancelMovesRequest(
  data: Gameplay.CancelMovesRequest,
): Promise<void> {
  if (!data.user) {
    console.error(
      '[GameplayActions] No user data in cancel-moves-request message',
    );
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
    console.log(
      `[GameplayActions] Game ${gameId} not found for user ${userId}`,
    );
    return;
  }

  gameServer.clearMoves(userId);
}

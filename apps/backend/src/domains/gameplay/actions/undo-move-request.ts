import { UserId, GameId } from '@kernel/ids';

import { getGameCoordinator } from '@/domains/gameplay/game-coordinator';

async function undoLastQueuedMove(userId: UserId, gameId: GameId): Promise<void> {
  const gameCoordinator = getGameCoordinator();
  const gameServer = gameCoordinator.requireGame(gameId);
  gameServer.undoMove(userId);
}

export { undoLastQueuedMove };

import { getGameCoordinator } from '@/domains/gameplay/game-coordinator';

async function undoLastQueuedMove(userId: number, gameId: number): Promise<void> {
  const gameCoordinator = getGameCoordinator();
  const gameServer = gameCoordinator.requireGame(gameId);
  gameServer.undoMove(userId);
}

export { undoLastQueuedMove };

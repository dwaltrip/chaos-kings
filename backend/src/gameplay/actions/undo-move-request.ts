import { Gameplay } from '@common/types/gameplay';
import { getGameCoordinator } from '@/gameplay/game-coordinator';

async function handleUndoMoveRequest(
  data: Gameplay.UndoMoveRequest,
): Promise<void> {
  const user = data.user;
  // TODO: This should be handled elsewhere
  if (!user) {
    throw Error('[GameplayActions] No user data in undo-move-request message');
  }

  const gameCoordinator = getGameCoordinator();
  // TODO: update handleCancelMovesRequest to have `gameId` in payload
  const gameServer = gameCoordinator.requireGame(data.payload.gameId);

  // TODO (user-id-type-issue): Fix this. Should be number already.
  const userId = Number(user.id);
  gameServer.undoMove(userId);
}

export { handleUndoMoveRequest };

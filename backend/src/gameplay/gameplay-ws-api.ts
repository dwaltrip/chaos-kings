import {
  GAMEPLAY_DOMAIN,
  type GameplayServerInbound,
} from '@common/types/gameplay';
import {
  queueMove,
  cancelQueuedMoves,
  addUserToGame,
  removeUserFromGame,
  getUserGame,
} from '@/gameplay/actions';
import { undoLastQueuedMove } from '@/gameplay/actions/undo-move-request';
import { getGameCoordinator } from '@/gameplay/game-coordinator';
import { createGameplayEffects } from '@/gameplay/ws-effects';

function handleGameplayMessage(
  msg: GameplayServerInbound,
  wsActions: any,
): void {
  const effects = createGameplayEffects(wsActions);

  switch (msg.type) {
    case 'join-room': {
      const user = msg.user;
      const { room } = msg.payload;
      if (!room) return;
      effects.joinGameplayRoom(room);

      if (user) {
        const userId = Number(user.id);
        const gameId = getUserGame(userId);
        if (gameId) {
          const gameCoordinator = getGameCoordinator();
          const gameServer = gameCoordinator.getGame(gameId);
          if (gameServer) {
            gameServer.onPlayerJoinedRoom(userId);
            console.log(
              `Player ${userId} joined gameplay room for game ${gameId}`,
            );
          } else {
            console.error(
              `No game server found for game ${gameId} when player ${userId} joined room ${room}`,
            );
          }
        } else {
          console.error(
            `No game mapping found for user ${userId} when joining room ${room}`,
          );
        }
      }
      break;
    }
    case 'leave-room': {
      const { room } = msg.payload;
      if (!room) return;
      effects.leaveGameplayRoom(room);
      break;
    }
    case 'move-request': {
      const user = msg.user;
      if (!user) return;
      const { sourceCoord, direction } = msg.payload;
      if (!sourceCoord || !direction) return;
      void queueMove(Number(user.id), sourceCoord, direction);
      break;
    }
    case 'cancel-moves-request': {
      const user = msg.user;
      if (!user) return;
      void cancelQueuedMoves(Number(user.id));
      break;
    }
    case 'undo-move-request': {
      const user = msg.user;
      if (!user) return;
      const { gameId } = msg.payload;
      if (!gameId) return;
      void undoLastQueuedMove(Number(user.id), Number(gameId));
      break;
    }
    default:
      break;
  }
}

export {
  handleGameplayMessage,
  addUserToGame,
  removeUserFromGame,
  getUserGame,
};

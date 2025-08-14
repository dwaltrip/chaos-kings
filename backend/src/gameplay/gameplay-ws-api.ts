import { DomainAPI } from '@/websocket/api';
import {
  Gameplay,
  GameplayMessageType,
  GAMEPLAY_DOMAIN,
} from '@common/types/gameplay';
import {
  handleMoveRequest,
  handleCancelMovesRequest,
  addUserToGame,
  removeUserFromGame,
  getUserGame,
} from './actions';
import { getGameCoordinator } from './game-coordinator';

const GameplayWsAPI = new DomainAPI<GameplayMessageType>(GAMEPLAY_DOMAIN, {
  'move-request': handleMoveRequest,

  'cancel-moves-request': handleCancelMovesRequest,

  'join-room': (data: Gameplay.JoinRoomMessage, wsActions) => {
    wsActions.joinRoom(data.payload.room);

    // Notify GameServer that player joined the room
    if (data.user?.id) {
      const userId = data.user.id.toString();
      const gameId = getUserGame(userId);
      if (gameId) {
        const gameCoordinator = getGameCoordinator();
        const gameServer = gameCoordinator.getGame(gameId);
        if (gameServer) {
          gameServer.onPlayerJoinedRoom(userId);
        }
      }
    }
  },

  'leave-room': (data: Gameplay.LeaveRoomMessage, wsActions) => {
    wsActions.leaveRoom(data.payload.room);
  },

  // Server -> Client messages (not handled by clients)
  'game-state-update': (data: Gameplay.GameStateUpdate, wsActions) => {
    // Clients don't send this message, only receive it
  },

  'game-starting': (data: Gameplay.GameStarting, wsActions) => {
    // Clients don't send this message, only receive it
  },

  'game-started': (data: Gameplay.GameStarted, wsActions) => {
    // Clients don't send this message, only receive it
  },

  'game-ended': (data: Gameplay.GameEnded, wsActions) => {
    // Clients don't send this message, only receive it
  },
});

export { GameplayWsAPI, addUserToGame, removeUserFromGame, getUserGame };

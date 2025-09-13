import {
  JoinRoomMessage,
  LeaveRoomMessage,
} from '@common/websockets/message-types';
import {
  Gameplay,
  GameplayMessageType,
  GAMEPLAY_DOMAIN,
} from '@common/types/gameplay';

import { DomainAPI } from '@/websocket/api';
import { WsActions } from '@/websocket/types';
import {
  handleMoveRequest,
  handleCancelMovesRequest,
  addUserToGame,
  removeUserFromGame,
  getUserGame,
} from '@/gameplay/actions';
import { getGameCoordinator } from '@/gameplay/game-coordinator';
import { handleUndoMoveRequest } from './actions/undo-move-request';

const GameplayWsAPI = new DomainAPI<GameplayMessageType>(GAMEPLAY_DOMAIN, {
  'move-request': handleMoveRequest,

  'undo-move-request': handleUndoMoveRequest,

  'cancel-moves-request': handleCancelMovesRequest,

  'join-room': (data: JoinRoomMessage, wsActions: WsActions) => {
    const room = data.payload.room;
    const userId = data.user?.id?.toString();

    wsActions.joinRoom(room);

    // Notify GameServer that player joined the room
    if (data.user?.id && userId) {
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
  },

  'leave-room': (data: LeaveRoomMessage, wsActions: WsActions) => {
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

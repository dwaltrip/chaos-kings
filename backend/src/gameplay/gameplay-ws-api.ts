import { DomainAPI } from '@/websocket/api';
import {
  Gameplay,
  GameplayMessageType,
  GAMEPLAY_DOMAIN
} from '@common/types/gameplay';
import {
  handleMoveRequest,
  handleCancelMovesRequest,
  addUserToGame,
  removeUserFromGame,
  getUserGame
} from './actions';

const GameplayWsAPI = new DomainAPI<GameplayMessageType>(GAMEPLAY_DOMAIN, {
  'move-request': handleMoveRequest,

  'cancel-moves-request': handleCancelMovesRequest,

  'join-room': (data: Gameplay.JoinRoomMessage, wsActions) => {
    wsActions.joinRoom(data.payload.room);
  },

  'leave-room': (data: Gameplay.LeaveRoomMessage, wsActions) => {
    wsActions.leaveRoom(data.payload.room);
  },

  // Server -> Client messages (not handled by clients)
  'game-state-update': (data: Gameplay.GameStateUpdate, wsActions) => {
    // Clients don't send this message, only receive it
  },

  'game-started': (data: Gameplay.GameStarted, wsActions) => {
    // Clients don't send this message, only receive it
  },

  'game-ended': (data: Gameplay.GameEnded, wsActions) => {
    // Clients don't send this message, only receive it
  }
});

export { GameplayWsAPI, addUserToGame, removeUserFromGame, getUserGame };
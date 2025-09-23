import {
  GAMEPLAY_DOMAIN,
  type GameplayClientMessageType,
} from '@common/types/gameplay';

import { DomainAPI } from '@/websocket/api';
import { WsActions } from '@/websocket/types';
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

const GameplayWsAPI = new DomainAPI<GameplayClientMessageType>(
  GAMEPLAY_DOMAIN,
  {
    'join-room': (data, wsActions: WsActions) => {
      const user = data.user;
      const room = (data as any).payload?.room as string;
      if (!room) return;
      const effects = createGameplayEffects(wsActions);
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
    },
    'leave-room': (data, wsActions: WsActions) => {
      const room = (data as any).payload?.room as string;
      if (!room) return;
      const effects = createGameplayEffects(wsActions);
      effects.leaveGameplayRoom(room);
    },
    'move-request': async (data) => {
      const user = data.user;
      if (!user) return;
      const p = (data as any).payload;
      if (!p || !p.sourceCoord || !p.direction) return;
      await queueMove(Number(user.id), p.sourceCoord, p.direction);
    },
    'cancel-moves-request': async (data) => {
      const user = data.user;
      if (!user) return;
      await cancelQueuedMoves(Number(user.id));
    },
    'undo-move-request': async (data) => {
      const user = data.user;
      if (!user) return;
      const gameId = Number((data as any).payload?.gameId);
      if (!gameId) return;
      await undoLastQueuedMove(Number(user.id), gameId);
    },
  },
);

export { GameplayWsAPI, addUserToGame, removeUserFromGame, getUserGame };

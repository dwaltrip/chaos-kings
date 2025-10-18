import { UserId } from '@kernel/domains/user';
import { GameId } from '@kernel/domains/game';
import { RoomId } from '@kernel/domains/system';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { GameplayClientMessage } from '@protocol/domains/gameplay/client-messages';
import { parseGameRoomId } from '@platform/domains/gameplay/helpers';

import type { HandlerContext } from '@/ws/types';
import { gameplayActions } from '@/domains/gameplay/actions';

const gameplayHandlers = {
  // TODO: shouldn't have gameplay messages dedicated to room management, I think?
  'gameplay:join-room': ({ room }, ctx) => {
    const gameIdNumber = parseGameRoomId(room);
    if (!gameIdNumber) {
      // TODO: [ERROR-HANDLING] Proper error handling for invalid room ID
      console.error(`Invalid game room ID: ${room}`);
      return;
    }
    gameplayActions.joinRoom(RoomId(room), GameId(gameIdNumber), UserId(ctx.userId));
  },

  // TODO: shouldn't have gameplay messages dedicated to room management, I think?
  'gameplay:leave-room': ({ room }, ctx) => {
    const gameIdNumber = parseGameRoomId(room);
    if (!gameIdNumber) {
      // TODO: [ERROR-HANDLING] Proper error handling for invalid room ID
      console.error(`Invalid game room ID: ${room}`);
      return;
    }
    gameplayActions.leaveRoom(RoomId(room), GameId(gameIdNumber), UserId(ctx.userId));
  },

  'gameplay:move-request': ({ sourceCoord, direction }, ctx) => {
    // TODO: [GAMEPLAY] Extract gameId from context (need user-to-game mapping)
    const gameIdNumber = -1;
    gameplayActions.queueMove(
      sourceCoord,
      direction,
      GameId(gameIdNumber),
      UserId(ctx.userId),
    );
  },

  'gameplay:cancel-moves': (payload, ctx) => {
    // TODO: [GAMEPLAY] Extract gameId from context (need user-to-game mapping)
    const gameIdNumber = -1;
    gameplayActions.cancelMoves(GameId(gameIdNumber), UserId(ctx.userId));
  },

  'gameplay:undo-move': ({ gameId }, ctx) => {
    gameplayActions.undoMove(GameId(gameId), UserId(ctx.userId));
  },
} satisfies HandlerMapWithCtx<GameplayClientMessage, HandlerContext>;

export { gameplayHandlers };

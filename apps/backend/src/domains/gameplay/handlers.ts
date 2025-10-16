import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { GameplayClientMessage } from '@protocol/domains/gameplay/client-messages';
import { parseGameRoomId } from '@platform/domains/gameplay/helpers';

import type { HandlerContext } from '@/ws/types';
import { gameplayActions } from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:join-room': ({ room }, ctx) => {
    const gameId = parseGameRoomId(room);
    if (!gameId) {
      // TODO: [ERROR-HANDLING] Proper error handling for invalid room ID
      console.error(`Invalid game room ID: ${room}`);
      return;
    }
    gameplayActions.joinRoom(room, gameId, ctx);
  },

  'gameplay:leave-room': ({ room }, ctx) => {
    const gameId = parseGameRoomId(room);
    if (!gameId) {
      // TODO: [ERROR-HANDLING] Proper error handling for invalid room ID
      console.error(`Invalid game room ID: ${room}`);
      return;
    }
    gameplayActions.leaveRoom(room, gameId, ctx);
  },

  'gameplay:move-request': ({ sourceCoord, direction }, ctx) => {
    // TODO: [GAMEPLAY] Extract gameId from context (need user-to-game mapping)
    // For now, passing dummy gameId - will be resolved during unstubbing
    const gameId = -1;
    gameplayActions.queueMove(sourceCoord, direction, gameId, ctx);
  },

  'gameplay:cancel-moves': (payload, ctx) => {
    // TODO: [GAMEPLAY] Extract gameId from context (need user-to-game mapping)
    // For now, passing dummy gameId - will be resolved during unstubbing
    const gameId = -1;
    gameplayActions.cancelMoves(gameId, ctx);
  },

  'gameplay:undo-move': ({ gameId }, ctx) => {
    gameplayActions.undoMove(gameId, ctx);
  },
} satisfies HandlerMapWithCtx<GameplayClientMessage, HandlerContext>;

export { gameplayHandlers };

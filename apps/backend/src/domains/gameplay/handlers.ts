import { GameId, UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { GameplayClientMessage } from '@protocol/domains/gameplay/client-messages';

import type { AppHandlerContext } from '@/ws/app-handler-context';
import { gameplayActions } from '@/domains/gameplay/actions';

const gameplayHandlers = {
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
} satisfies HandlerMapWithCtx<GameplayClientMessage, AppHandlerContext>;

export { gameplayHandlers };

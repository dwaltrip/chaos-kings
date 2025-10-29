import { GameId, UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { GameplayClientMessage } from '@protocol/domains/gameplay/client-messages';

import type { AppHandlerContext } from '@/ws/app-handler-context';
import {
  queueMove,
  cancelQueuedMoves,
  undoLastQueuedMove,
} from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:move-request': ({ sourceCoord, direction }, ctx) => {
    queueMove(UserId(ctx.userId), sourceCoord, direction);
  },

  'gameplay:cancel-moves': (payload, ctx) => {
    cancelQueuedMoves(UserId(ctx.userId));
  },

  'gameplay:undo-move': ({ gameId }, ctx) => {
    undoLastQueuedMove(UserId(ctx.userId), GameId(gameId));
  },
} satisfies HandlerMapWithCtx<GameplayClientMessage, AppHandlerContext>;

export { gameplayHandlers };

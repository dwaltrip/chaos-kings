import { GameId, UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { GameplayClientMessage } from '@protocol/domains/gameplay/client-messages';

import type { ConnectionContext } from '@/ws/connection-context';
import {
  queueMove,
  cancelQueuedMoves,
  undoLastQueuedMove,
  onPlayerJoined,
  onPlayerLeft,
} from '@/domains/gameplay/actions';

const gameplayHandlers = {
  'gameplay:join-game': ({ gameId }, ctx) => {
    onPlayerJoined(GameId(gameId), UserId(ctx.userId), ctx.connectionId);
  },

  'gameplay:leave-game': ({ gameId }, ctx) => {
    onPlayerLeft(GameId(gameId), UserId(ctx.userId), ctx.connectionId);
  },

  'gameplay:move-request': ({ sourceCoord, direction }, ctx) => {
    queueMove(UserId(ctx.userId), sourceCoord, direction);
  },

  'gameplay:cancel-moves': (payload, ctx) => {
    cancelQueuedMoves(UserId(ctx.userId));
  },

  'gameplay:undo-move': (payload, ctx) => {
    undoLastQueuedMove(UserId(ctx.userId));
  },
} satisfies HandlerMapWithCtx<GameplayClientMessage, ConnectionContext>;

export { gameplayHandlers };

import { UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { PuzzlesClientMessage } from '@protocol/domains/puzzles/client-messages';

import type { ConnectionContext } from '@/ws/connection-context';
import { puzzleActions } from '@/domains/puzzles/actions';

const puzzlesHandlers = {
  'puzzles:start-playing': ({}, ctx) => {
    puzzleActions.startPuzzle(UserId(ctx.userId), ctx.connectionId);
  },
  'puzzles:move-request': ({ sourceCoord, direction }, ctx) => {
    puzzleActions.queueMove(UserId(ctx.userId), sourceCoord, direction);
  },
  'puzzles:undo-move': ({}, ctx) => {
    puzzleActions.undoMove(UserId(ctx.userId));
  },
  'puzzles:cancel-moves': ({}, ctx) => {
    puzzleActions.clearMoves(UserId(ctx.userId));
  },
} satisfies HandlerMapWithCtx<PuzzlesClientMessage, ConnectionContext>;

export { puzzlesHandlers };

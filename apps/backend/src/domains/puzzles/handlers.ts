import { UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { PuzzlesClientMessage } from '@protocol/domains/puzzles/client-messages';

import type { ConnectionContext } from '@/ws/connection-context';
import { setupAndStartPuzzle } from '@/domains/puzzles/actions';

const puzzlesHandlers = {
  'puzzles:start-playing': ({}, ctx) => {
    setupAndStartPuzzle(UserId(ctx.userId));
  },
  'puzzles:move-request': () => {},
  'puzzles:undo-move': () => {},
  'puzzles:cancel-moves': () => {},
} satisfies HandlerMapWithCtx<PuzzlesClientMessage, ConnectionContext>;

export { puzzlesHandlers };

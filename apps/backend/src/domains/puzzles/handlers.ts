// import { GameId, UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { PuzzlesClientMessage } from '@protocol/domains/puzzles/client-messages';

import type { ConnectionContext } from '@/ws/connection-context';

const puzzlesHandlers = {
  'puzzles:start-playing': () => {},
  'puzzles:move-request': () => {},
  'puzzles:undo-move': () => {},
  'puzzles:cancel-moves': () => {},
} satisfies HandlerMapWithCtx<PuzzlesClientMessage, ConnectionContext>;

export { puzzlesHandlers };

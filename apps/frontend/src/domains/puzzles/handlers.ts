import type { PuzzlesServerMessage } from '@protocol/domains/puzzles/server-messages';

import type { HandlerMap } from '@/ws-lib';
import {
  handleStateUpdate,
  handlePuzzleEnd,
} from '@/domains/puzzles/actions/puzzle-actions';

const puzzlesHandlers = {
  'puzzles:state-update': (payload) => {
    handleStateUpdate(payload.tick, payload.board, payload.moveQueue);
  },

  'puzzles:end-puzzle': (payload) => {
    handlePuzzleEnd(payload.result, payload.finalBoard);
  },
} satisfies HandlerMap<PuzzlesServerMessage>;

export { puzzlesHandlers };

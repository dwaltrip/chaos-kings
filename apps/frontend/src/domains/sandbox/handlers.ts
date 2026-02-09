import type { SandboxServerMessage } from '@protocol/domains/sandbox/server-messages';

import type { HandlerMap } from '@/ws-lib';
import {
  handleSessionStarted,
  handleStateUpdate,
  handleError,
} from '@/domains/sandbox/actions';

const sandboxHandlers = {
  'sandbox:session-started': (payload) => {
    handleSessionStarted(payload.board, payload.config);
  },

  'sandbox:state-update': (payload) => {
    handleStateUpdate(
      payload.tick,
      payload.board,
      payload.moveQueue,
      payload.isPaused,
      payload.maxTickReached,
      payload.lastExecutedMove,
    );
  },

  'sandbox:error': (payload) => {
    handleError(payload.message, payload.code);
  },
} satisfies HandlerMap<SandboxServerMessage>;

export { sandboxHandlers };

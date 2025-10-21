import type { HandlerMap } from '@protocol/utils/message-helpers';
import type { SystemServerMessage } from '@protocol/domains/system/server-messages';

type SystemHandlerMap = HandlerMap<SystemServerMessage>;

const systemHandlers = {
  'system:room-status-update': (payload) => {
    // TODO: Wire this into real state once the WS client pub/sub utilities land (Phase 2.2).
    console.debug('[systemHandlers] Received room status update (stub).', payload);
  },
} as const satisfies SystemHandlerMap;

export { systemHandlers };

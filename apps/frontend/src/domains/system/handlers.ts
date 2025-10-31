import type { SystemServerMessage } from '@protocol/domains/system/server-messages';

import type { HandlerMap } from '@/ws-lib';

type SystemHandlerMap = HandlerMap<SystemServerMessage>;

const systemHandlers = {
  'system:room-status-update': (payload) => {
    // TODO: Can explore using this for showing how many users are in a room, etc.
    // Not a priority right now.
    console.debug('[systemHandlers] Received room status update (stub).', payload);
  },
} as const satisfies SystemHandlerMap;

export { systemHandlers };

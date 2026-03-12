import { UserId } from '@kernel/ids';

import { wsBridge } from '@/ws/server-bridge-bootstrap';
import { sandboxActions } from '@/domains/sandbox/actions';

function init() {
  wsBridge.onDisconnect((context) => {
    sandboxActions.handleDisconnect(UserId(context.userId), context.connectionId);
  });
}

export { init };

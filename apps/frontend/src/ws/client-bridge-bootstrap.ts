import { ClientBridge } from '@/ws-lib/client-bridge';

import type { ClientMessage } from '@/ws/message-types';

const wsBridge = new ClientBridge<ClientMessage>();

export { wsBridge };

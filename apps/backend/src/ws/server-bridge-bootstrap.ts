import type { User } from '@platform/domains/users/types-deprecated';
import { ServerBridge } from '@/ws-lib/server-bridge';

import type { ServerMessage } from '@/ws/message-types';

// Export singleton instance
const wsBridge = new ServerBridge<ServerMessage, User>();

export { wsBridge };

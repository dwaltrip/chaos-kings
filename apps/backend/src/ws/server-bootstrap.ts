import type { User } from '@common/types/user';

import { createWSServer, wsBridge } from '@/ws-lib';
import type { ClientMessage, ServerMessage, HandlerMapWithCtx } from '@/ws-lib/types';

import type { AppHandlerContext } from '@/ws/app-handler-context';
import { chatHandlers } from '@/domains/chat/handlers';
import { matchmakingHandlers } from '@/domains/matchmaking/handlers';
import { gameplayHandlers } from '@/domains/gameplay/handlers';

// Merge all domain handlers into single map
const mergedHandlers: HandlerMapWithCtx<ClientMessage, AppHandlerContext> = {
  ...chatHandlers,
  ...matchmakingHandlers,
  ...gameplayHandlers,
} satisfies HandlerMapWithCtx<ClientMessage, AppHandlerContext>;

function setupWebSocketV2() {
  // Create WS server with typed config
  const wsServer = createWSServer<ClientMessage, ServerMessage, AppHandlerContext, User>({
    handlers: mergedHandlers,
    createContext: (user, connectionId) => ({
      userId: user.id,
      connectionId,
    }),
    getUserKey: (user) => String(user.id), // stable identifier used by sendToUser()
    onDisconnect: (context) => {
      console.log(`[WS] Client disconnected: ${context.connectionId}`);
    },
  });

  // Initialize bridge
  wsBridge.init(wsServer);

  return wsServer;
}

export { setupWebSocketV2 };

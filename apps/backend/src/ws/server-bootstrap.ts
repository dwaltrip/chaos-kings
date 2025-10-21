import type { User } from '@common/types/user';

import { createWSServer } from '@/ws-lib';
import type { HandlerMapWithCtx } from '@/ws-lib/types';

import type { ClientMessage, ServerMessage } from '@/ws/message-types';
import type { AppHandlerContext } from '@/ws/app-handler-context';
import { wsBridge } from '@/ws/server-bridge-bootstrap';

import { chatHandlers } from '@/domains/chat/handlers';
import { matchmakingHandlers } from '@/domains/matchmaking/handlers';
import { gameplayHandlers } from '@/domains/gameplay/handlers';
import { systemHandlers } from '@/domains/system/handlers';
import { roomMembershipTracker } from '@/domains/system/membership-tracker';
import { systemWsEffects } from '@/domains/system/ws-effects';

// Merge all domain handlers into single map
const mergedHandlers: HandlerMapWithCtx<ClientMessage, AppHandlerContext> = {
  ...chatHandlers,
  ...matchmakingHandlers,
  ...systemHandlers,
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
      const affectedRooms = roomMembershipTracker.removeConnectionFromAll(
        context.connectionId,
      );
      affectedRooms.forEach((roomId) => {
        const memberIds = roomMembershipTracker.getUserIds(roomId);
        systemWsEffects.broadcastRoomStatus({ roomId, memberIds });
      });
    },
  });

  // Initialize bridge
  wsBridge.init(wsServer);

  return wsServer;
}

export { setupWebSocketV2 };

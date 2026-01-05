import type { User } from '@platform/domains/users/types-deprecated';

import { createWSServer } from '@/ws-lib';
import type { HandlerMapWithCtx } from '@/ws-lib/types';

import type { ClientMessage, ServerMessage } from '@/ws/message-types';
import type { ConnectionContext } from '@/ws/connection-context';
import { wsBridge } from '@/ws/server-bridge-bootstrap';
import { runInContextWithTransaction } from '@/context/app-context';

import { chatHandlers } from '@/domains/chat/handlers';
import { matchmakingHandlers } from '@/domains/matchmaking/handlers';
import { gameplayHandlers } from '@/domains/gameplay/handlers';
import { puzzlesHandlers } from '@/domains/puzzles/handlers';
import { systemHandlers } from '@/domains/system/handlers';

import { roomMembershipTracker } from '@/domains/system/membership-tracker';
import { systemWsEffects } from '@/domains/system/ws-effects';

// Merge all domain handlers into single map
const mergedHandlers: HandlerMapWithCtx<ClientMessage, ConnectionContext> = {
  ...systemHandlers,
  ...chatHandlers,
  ...matchmakingHandlers,
  ...gameplayHandlers,
  ...puzzlesHandlers,
} satisfies HandlerMapWithCtx<ClientMessage, ConnectionContext>;

function setupWebSocketV2() {
  // Create WS server with typed config
  const wsServer = createWSServer<ClientMessage, ServerMessage, ConnectionContext, User>({
    handlers: mergedHandlers,
    createConnectionContext: (user, connectionId) => ({
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
    // Wrap each message in AppContext scope
    setupHandlerContext: async (execute) => {
      return await runInContextWithTransaction(execute);
    },
  });

  // Initialize bridge
  wsBridge.init(wsServer);

  return wsServer;
}

export { setupWebSocketV2 };

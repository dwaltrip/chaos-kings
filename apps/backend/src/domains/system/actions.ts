import type { HandlerContext } from '@/ws/types';

const systemActions = {
  joinRoom(roomId: string, ctx: HandlerContext) {
    // TODO: [SYSTEM_DOMAIN] Implement room membership management
    // - Add userId to room in wsBridge
    // - Track room membership in Redis/state
  },

  leaveRoom(roomId: string, ctx: HandlerContext) {
    // TODO: [SYSTEM_DOMAIN] Implement room membership management
    // - Remove userId from room in wsBridge
    // - Clean up room membership in Redis/state
  },
};

export { systemActions };

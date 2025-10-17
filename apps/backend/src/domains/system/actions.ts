import { RoomId } from '@kernel/domains/system';
import { UserId } from '@kernel/domains/user';

const systemActions = {
  joinRoom(roomId: RoomId, userId: UserId) {
    // TODO: [SYSTEM_DOMAIN] Implement room membership management
    // - Add userId to room in wsBridge
    // - Track room membership in Redis/state
  },

  leaveRoom(roomId: RoomId, userId: UserId) {
    // TODO: [SYSTEM_DOMAIN] Implement room membership management
    // - Remove userId from room in wsBridge
    // - Clean up room membership in Redis/state
  },
};

export { systemActions };

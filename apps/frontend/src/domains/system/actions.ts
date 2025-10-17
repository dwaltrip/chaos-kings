import { RoomId } from '@kernel/domains/system';

const systemWsEffects = {
  joinRoom(roomId: RoomId) {
    // TODO: [SYSTEM_DOMAIN] Implement room join via WebSocket
    // - Send system:join-room message to backend
    // - May need to define system domain protocol messages
    // - Use idToString(roomId) when sending message
  },

  leaveRoom(roomId: RoomId) {
    // TODO: [SYSTEM_DOMAIN] Implement room leave via WebSocket
    // - Send system:leave-room message to backend
    // - May need to define system domain protocol messages
    // - Use idToString(roomId) when sending message
  },
};

export { systemWsEffects };

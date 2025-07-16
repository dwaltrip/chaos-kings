
import { getWebSocketService } from '../services/websocket-service';

function websocketConnect() {
  console.log(`[Chat-Actions] Initializing chat demo`);
  const wsService = getWebSocketService();
  const store = useChatDemoStore.getState();

  // If already connected, join the current room immediately
  if (wsService.isConnected) {
    const currentRoom = useChatDemoStore.getState().currentRoom;
    console.log(`[Chat-Actions] Already connected, immediately joining room: ${currentRoom}`);
    joinRoom(currentRoom);
  }

  return { cleanup, joinRoom };
}

function sendChatMessage() {
  // Implementation of sending chat message
}

export {
  connect,
  sendChatMessage,
};

import { ChatDemoStore as store  } from './chat-demo-store';
import { getWebSocketService } from '../services/websocket-service';

function websocketConnect(): ReturnType<typeof getWebSocketService> {
  console.log(`[chat-actions] Initializing chat demo`);
  const wsService = getWebSocketService();

  // Join current room after connection is established
  wsService.addListener('open', () => {
    const currentRoom = store.getCurrentRoom();
    console.log(`[chat-actions] Joining room: ${currentRoom}`);
    joinRoom(currentRoom, store.getUsername());
  });
  return wsService;
}

function sendChatMessage(message: string, username: string, room: string) {
  console.log(`[chat-actions] Attempting to send message: "${message}" from ${username} in room ${room}`);
  const wsService = getWebSocketService();
  
  if (!wsService.isConnected) {
    console.error(`[chat-actions] Cannot send message: Not connected`);
    return;
  }
  if (!message.trim()) {
    console.error(`[chat-actions] Cannot send message: Message is empty`);
    return;
  }
  if (!username.trim()) {
    console.error(`[chat-actions] Cannot send message: Username is empty`);
    return;
  }

  wsService.send({
    user: username,
    domain: 'chat-demo',
    payload: {
      type: 'chat-message',
      data: {
        content: message.trim(),
        room,
      },
    },
    timestamp: Date.now(),
  });
  store.setCurrentMessage('');
}

function setCurrentMessage(message: string) {
  store.setCurrentMessage(message);
}

function setUsername(username: string) {
  store.setUsername(username);
}

function setNewRoomName(roomName: string) {
  store.setNewRoomName(roomName);
}

function joinRoom(room: string, username: string) {
  console.log(`[chat-actions] Joining room: ${room}`);
  const wsService = getWebSocketService();
  if (!wsService.isConnected) {
    console.error(`[chat-actions] Cannot join room: Not connected`);
    return;
  }
  wsService.send({
    user: username,
    domain: 'chat-demo',
    payload: {
      type: 'join-room',
      data: { room },
    },
    timestamp: Date.now(),
  });
  store.setCurrentRoom(room);
  // Additional logic to handle room change
}

function createAndJoinRoom(name: string) {
  console.log(`[chat-actions] Creating and joining room: ${name}`);
  store.setNewRoomName(name);
  // Additional logic to create and join the room
}

export {
  websocketConnect,
  sendChatMessage,
  setCurrentMessage,
  setUsername,
  setNewRoomName,
  joinRoom,
  createAndJoinRoom,
};

import { ChatDemoStore as store  } from './chat-demo-store';
import { getWebSocketService } from '../services/websocket-service';
import { createChatMessage } from '../../../types/websockets';

const LOG_PREFIX = '[chat-actions]';
const logger = (...args: any[]) => console.log(LOG_PREFIX, ...args);
logger.error = (...args: any[]) => console.error(LOG_PREFIX, ...args);

function websocketConnect(): ReturnType<typeof getWebSocketService> {
  logger(`Initializing chat demo`);
  const wsService = getWebSocketService();

  // Join current room after connection is established
  wsService.addListener('open', () => {
    const currentRoom = store.getCurrentRoom();
    logger(`Joining room: ${currentRoom}`);
    joinRoom(currentRoom, store.getUsername());
  });
  return wsService;
}

function sendChatMessage(message: string, username: string, room: string) {
  logger(`Sending "${message}" from ${username} in room ${room}`);
  const wsService = getWebSocketService();
  
  if (!wsService.isConnected) {
    logger.error(`Cannot send: Not connected`);
    return;
  }
  if (!message.trim()) {
    logger.error(`Cannot send: Message is empty`);
    return;
  }
  if (!username.trim()) {
    logger.error(`Cannot send: Username is empty`);
    return;
  }

  wsService.send(createChatMessage(message.trim(), room, username));
  store.setCurrentMessage('');
}

function setCurrentMessage(message: string) {
  store.setCurrentMessage(message);
}

function setUsername(username: string) {
  store.setUsername(username);
  const wsService = getWebSocketService();
  if (wsService.isConnected) {
    wsService.send({
      user: username,
      domain: 'chat-demo',
      payload: {
        type: 'set-username',
        data: { user: username },
      },
      timestamp: Date.now(),
    });
  }
}

function setNewRoomName(roomName: string) {
  store.setNewRoomName(roomName);
}

function joinRoom(room: string, username: string) {
  logger(`Joining room: ${room}`);
  const wsService = getWebSocketService();
  if (!wsService.isConnected) {
    logger.error(`Cannot join room: Not connected`);
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
}

function createAndJoinRoom(name: string) {
  logger(`Creating and joining room: ${name}`);
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

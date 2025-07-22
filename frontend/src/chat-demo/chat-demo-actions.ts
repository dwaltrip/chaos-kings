import { chatStore } from '@/chat-demo/chat-demo-store';

const { actions } = chatStore.getState();
import { getWebSocketService } from '@/services/websocket-service';
import { createNewChatMessage, createJoinRoomMessage } from '@common/types/chat-demo';

const LOG_PREFIX = '[chat-actions]';
const logger = (...args: any[]) => console.log(LOG_PREFIX, ...args);
logger.error = (...args: any[]) => console.error(LOG_PREFIX, ...args);

function websocketConnect(): ReturnType<typeof getWebSocketService> {
  logger(`Initializing chat demo`);
  const wsService = getWebSocketService();

  // Join current room after connection is established
  wsService.addListener('open', () => {
    const currentRoom = chatStore.getState().currentRoom;
    logger(`Joining room: ${currentRoom}`);
    joinRoom(currentRoom, chatStore.getState().username);
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

  wsService.send(createNewChatMessage(message.trim(), room, username));
  actions.setCurrentMessage('');
}

function setCurrentMessage(message: string) {
  actions.setCurrentMessage(message);
}

function setUsername(username: string) {
  actions.setUsername(username);
  const wsService = getWebSocketService();
  if (wsService.isConnected) {
    wsService.send({
      domain: 'chat-demo',
      type: 'set-username',
      payload: {
        user: username,
      },
    });
  }
}

function setNewRoomName(roomName: string) {
  actions.setNewRoomName(roomName);
}

function joinRoom(room: string, username: string) {
  logger(`Joining room: ${room}`);
  const wsService = getWebSocketService();
  if (!wsService.isConnected) {
    logger.error(`Cannot join room: Not connected`);
    return;
  }
  wsService.send(createJoinRoomMessage(room, username));
  actions.setCurrentRoom(room);
}

function createAndJoinRoom(name: string) {
  logger(`Creating and joining room: ${name}`);
  actions.setNewRoomName(name);
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

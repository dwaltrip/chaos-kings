import { type Game } from '@common/types/games';
import { roomNameForGameChat } from '@common/domains/game/utils';
import { gameChatStore } from '@/pages/game/game-chat/game-chat-store';

const { actions } = gameChatStore.getState();
import { getWebSocketService } from '@/services/websocket-service';
import { createNewChatMessage, createJoinRoomMessage } from '@common/types/chat-demo';

function websocketConnect({ game }: { game: Game }): ReturnType<typeof getWebSocketService> {
  const wsService = getWebSocketService();

  // Join current room after connection is established
  wsService.addListener('open', () => {
    joinRoom(roomNameForGameChat(game), gameChatStore.getState().username);
  });
  return wsService;
}

function sendChatMessage(message: string, username: string, room: string) {
  const wsService = getWebSocketService();
  wsService.send(createNewChatMessage(message.trim(), room, username));
  actions.setCurrentMessage('');
}

function setCurrentMessage(message: string) {
  actions.setCurrentMessage(message);
}

function joinRoom(room: string) {
  const wsService = getWebSocketService();
  wsService.send(createJoinRoomMessage(room);
}

export {
  websocketConnect,
  sendChatMessage,
  setCurrentMessage,
  joinRoom,
};

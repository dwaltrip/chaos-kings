import { type Game } from '@common/types/games';
import { roomNameForGameChat } from '@common/domains/game/utils';
import { gameChatStore } from '@/pages/game/game-chat/game-chat-store';

const { actions } = gameChatStore.getState();
import { getWebSocketService } from '@/services/websocket-service';
import {
  createNewChatMessage,
  createJoinRoomMessage,
} from '@common/types/game-chat';

function websocketConnect({
  game,
}: {
  game: Game;
}): ReturnType<typeof getWebSocketService> {
  const wsService = getWebSocketService();

  // Join current room after connection is established
  wsService.onReadyOrNow().then(() => {
    joinRoom(roomNameForGameChat(game));
  });
  return wsService;
}

function sendChatMessage(message: string, game: Game) {
  const room = roomNameForGameChat(game);
  const wsService = getWebSocketService();
  wsService.send(createNewChatMessage(message.trim(), room));
  actions.setNewMessage('');
}

function setNewMessage(message: string) {
  actions.setNewMessage(message);
}

function joinRoom(room: string) {
  const wsService = getWebSocketService();
  wsService.send(createJoinRoomMessage(room));
}

export { websocketConnect, sendChatMessage, setNewMessage, joinRoom };

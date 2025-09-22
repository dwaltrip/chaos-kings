import { type Game } from '@common/types/games';
import { bareRoomForGameChat } from '@common/domains/game/utils';
import { GAME_CHAT_DOMAIN } from '@common/types/game-chat';
import { createJoinRoomMessage } from '@common/websockets/message-types';

import { getWebSocketService } from '@/services/websocket-service';
import { gameChatStore } from '@/pages/game/game-chat/game-chat-store';

const { actions } = gameChatStore.getState();

function sendChatMessage(message: string, game: Game) {
  const room = bareRoomForGameChat(game);
  const wsService = getWebSocketService();
  wsService.send({
    domain: GAME_CHAT_DOMAIN,
    type: 'post-message',
    payload: {
      room,
      content: message.trim(),
      timestamp: Date.now(),
    },
  });
  actions.setNewMessage('');
}

function setNewMessage(message: string) {
  actions.setNewMessage(message);
}

function joinRoom(room: string) {
  const wsService = getWebSocketService();
  wsService.send(createJoinRoomMessage(GAME_CHAT_DOMAIN, room));
}

export { sendChatMessage, setNewMessage, joinRoom };

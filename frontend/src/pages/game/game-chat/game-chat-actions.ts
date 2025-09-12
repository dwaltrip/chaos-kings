import { type Game } from '@common/types/games';
import { roomNameForGameChat } from '@common/domains/game/utils';
import {
  createNewChatMessage,
  createJoinRoomMessage,
} from '@common/types/game-chat';

import { getWebSocketService } from '@/services/websocket-service';
import { gameChatStore } from '@/pages/game/game-chat/game-chat-store';

const { actions } = gameChatStore.getState();

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

export { sendChatMessage, setNewMessage, joinRoom };

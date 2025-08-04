import { DomainAPI } from '@/websocket/api';
import { GameChat } from '@common/types/game-chat';

const GameChatWsAPI = new DomainAPI('game-chat', {
  'new-message': (data: GameChat.ChatMessage, wsActions) => {
    console.log(`[game-chat] Received chat message:`, data);
    wsActions.broadcastToRoom(data.payload.room, data);
  },
  'join-room': (data: GameChat.JoinRoomMessage, wsActions) => {
    wsActions.joinRoom(data.payload.room);
  },
  'leave-room': (payload: any, wsActions) => {
    wsActions.leaveRoom(payload.room);
  },
});

export { GameChatWsAPI };

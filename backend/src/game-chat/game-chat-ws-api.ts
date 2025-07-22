import { DomainAPI } from '@/websocket/api';
import { ChatDemo } from '@common/types/chat-demo';

const GameChatWsAPI = new DomainAPI('chat-demo', {
  'new-message': (data: ChatDemo.ChatMessage, wsActions) => {
    console.log(`[game-chat] Received chat message:`, data);
    wsActions.broadcastToRoom(data.payload.room, data);
  },
  'join-room': (data: ChatDemo.JoinRoomMessage, wsActions) => {
    wsActions.joinRoom(data.payload.room);
  },
  'leave-room': (payload: any, wsActions) => {
    wsActions.leaveRoom(payload.room);
  },
});
// registerDomainAPI(domainAPI);

export { GameChatWsAPI };

// wsActions.sendToSelf({ status: 'ok' });
// wsActions.sendToClient(payload.sendtoClientId, { status: 'ok' });

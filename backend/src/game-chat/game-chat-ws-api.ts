import { DomainAPI } from '../websocket/api';

// TODO: define type for `payload`
const GameChatWsAPI = new DomainAPI('chat-demo', {
  'chat-message': (payload: any, wsActions) => {
    console.log(`[game-chat] Received chat message:`, payload);
    wsActions.broadcastToRoom(payload.data.room, { ...payload });
  },
  'join-room': (payload: any, wsActions) => {
    wsActions.joinRoom(payload.data.room);
  },
  'leave-room': (payload: any, wsActions) => {
    wsActions.leaveRoom(payload.room);
  },
});
// registerDomainAPI(domainAPI);

export { GameChatWsAPI };

// wsActions.sendToSelf({ status: 'ok' });
// wsActions.sendToClient(payload.sendtoClientId, { status: 'ok' });

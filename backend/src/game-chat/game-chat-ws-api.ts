import { DomainAPI, registerDomainAPI } from '../websocket/api';
import { WsActions } from '../websocket/types';

// const domainAPI = new DomainAPI('game-chat', {
const domainAPI = new DomainAPI('chat-demo', {
  'chat-message': (payload: any, wsActions) => {
    wsActions.broadcastToRoom(payload.room, { ...payload });
  },
  'join-room': (payload: any, wsActions) => {
    wsActions.joinRoom(payload.room);
  },
  'leave-room': (payload: any, wsActions) => {
    wsActions.leaveRoom(payload.room);
  },
});

registerDomainAPI(domainAPI);


// wsActions.sendToSelf({ status: 'ok' });
// wsActions.sendToClient(payload.senderClientId, { status: 'ok' });

import { DomainAPI, registerDomainAPI } from '../websocket/api';
import { WsActions } from '../websocket/types';

const domainAPI = new DomainAPI('game-chat', {
  'chat-message': (payload: any, wsActions) => {
    // ---------------------------------------------------
    // wooooooooooooooo
    // example usage of wsActions:
    wsActions.broadcastToRoom(payload.room, { message: payload.message });
    wsActions.sendToSelf({ status: 'ok' });
    wsActions.sendToClient(payload.senderClientId, { status: 'ok' });
    // ---------------------------------------------------
    // ---------------------------------------------------
  },
  'join-room': (payload: any) => {
  },
  'leave-room': (payload: any) => {
  },
});

registerDomainAPI(domainAPI);

import { DomainAPI, registerDomainAPI } from '../websocket-api';

const domainAPI = new DomainAPI('game-chat', {
  'chat-message': (payload: any) => {
  },
  'join-room': (payload: any) => {
  },
  'leave-room': (payload: any) => {
  },
});

registerDomainAPI(domainAPI);

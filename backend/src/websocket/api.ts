import { WsActions, WsMessageHandler, WsMessage } from './types';


// interface WsActions {
//   joinRoom: (roomId: string) => void;
//   leaveRoom: (roomId: string) => void;
//   sendToSelf: (message: any) => void;
//   sendToClient: (clientId: WsClientId, message: any) => void;
//   broadcastToRoom: (roomId: string, message: any) => void;
// }

function injectDomain(domain: string, actions: WsActions): WsActions {
  return {
    ...actions,
    broadcastToRoom: (roomId: string, payload: any) => {
      actions.broadcastToRoom(roomId, { ...payload, domain });
    }
  }
}

// TODO: is "app" a better name than "domain"?
class DomainAPI {
  constructor(public name: string, private handlers: Record<string, WsMessageHandler>) {
  }

  handleMessage(type: string, payload: any, actions: WsActions) {
    if (!this.handlers[type]) {
      throw new Error(`No handler for message type: ${type} in domain: ${this.name}`);
    }
    this.handlers[type](payload, injectDomain(this.name, actions));
  }
}

class WebSocketAPI {
  private domains = new Map<string, DomainAPI>();

  handleMessage(message: WsMessage, actions: WsActions) {
    const { domain, payload, user, timestamp } = message;
    const domainAPI = this.requireDomainAPI(domain);
    domainAPI.handleMessage(payload.type, { ...payload, user, timestamp }, actions);
  }

  private requireDomainAPI(appName: string): DomainAPI {
    const handler = this.domains.get(appName);
    if (!handler) {
      console.debug('Available domains:', Array.from(this.domains.keys()));
      throw new Error(`No handler registered for app: ${appName}`);
    }
    return handler;
  }

  public registerDomain(domainAPI: DomainAPI) {
    if (this.domains.has(domainAPI.name)) {
      throw new Error(`App already registered: ${domainAPI.name}`);
    }
    this.domains.set(domainAPI.name, domainAPI);
  }
}

const websocketAPI = new WebSocketAPI();

function handleWebSocketMessage(data: WsMessage, wsActions: WsActions) {
  websocketAPI.handleMessage(data, wsActions);
} 

function registerDomainAPI(domainAPI: DomainAPI) {
  console.log(`[websocket-api] Registering domain: ${domainAPI.name}`);
  websocketAPI.registerDomain(domainAPI);
}

export {
  DomainAPI,
  handleWebSocketMessage,
  registerDomainAPI,
};

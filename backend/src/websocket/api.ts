import { WsActions, WsMessageHandler, WsMessage } from '@/websocket/types';



function injectDomain(domain: string, actions: WsActions): WsActions {
  return {
    ...actions,
    broadcastToRoom: (roomId, data) => {
      actions.broadcastToRoom(roomId, { ...data, domain });
    }
  }
}

// TODO: is "app" a better name than "domain"?
class DomainAPI {
  constructor(public name: string, private handlers: Record<string, WsMessageHandler>) {
  }

  handleMessage(type: string, data: WsMessage, actions: WsActions) {
    if (this.handlers[type]) {
      this.handlers[type](data, injectDomain(this.name, actions));
    }
    else {
      // throw new Error(`No handler for message type: ${type} in domain: ${this.name}`);
      console.warn(`[ws-api] No handler for message type: ${type} in domain: ${this.name}`);
    }
  }
}

class WebSocketAPI {
  private domains = new Map<string, DomainAPI>();

  handleMessage(data: WsMessage, actions: WsActions) {
    const { domain, type } = data;
    const domainAPI = this.requireDomainAPI(domain);
    domainAPI.handleMessage(type, data, actions);
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
  console.log(`[ws-api] Registering domain: ${domainAPI.name}`);
  websocketAPI.registerDomain(domainAPI);
}

export {
  DomainAPI,
  handleWebSocketMessage,
  registerDomainAPI,
};

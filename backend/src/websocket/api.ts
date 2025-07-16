import { WsActions, WsMessageHandler, WsMessage } from './types';

// TODO: is "app" a better name than "domain"?
class DomainAPI {
  constructor(public name: string, private handlers: Record<string, WsMessageHandler>) {
  }

  handleMessage(type: string, payload: any, actions: WsActions) {
    if (!this.handlers[type]) {
      throw new Error(`No handler for message type: ${type} in domain: ${this.name}`);
    }
    this.handlers[type](payload, actions);
  }
}

class WebSocketAPI {
  private domains = new Map<string, DomainAPI>();

  handleMessage(message: WsMessage, actions: WsActions) {
    const { domain, payload } = message;
    const domainAPI = this.requireDomainAPI(domain);
    domainAPI.handleMessage(payload.type, payload, actions);
  }

  private requireDomainAPI(appName: string): DomainAPI {
    const handler = this.domains.get(appName);
    if (!handler) {
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
  websocketAPI.registerDomain(domainAPI);
}

export {
  DomainAPI,
  handleWebSocketMessage,
  registerDomainAPI,
};

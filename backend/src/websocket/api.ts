import { WsActions, WsMessageHandler } from './types';

interface WebSocketMessage {
  domain: string;
  type: string;
  payload: any;
}

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

  handleMessage(data: WebSocketMessage, actions: WsActions) {
    const domainAPI = this.requireDomainAPI(data.domain);
    domainAPI.handleMessage(data.type, data.payload, actions);
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

function handleWebSocketMessage(data: WebSocketMessage, wsActions: WsActions) {
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

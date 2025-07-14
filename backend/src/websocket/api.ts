
interface WebSocketMessage {
  domain: string;
  type: string;
  payload: any;
}

type HandlerFunction = (payload: any) => void;

// TODO: is "app" a better name than "domain"?
class DomainAPI {
  constructor(public name: string, private handlers: Record<string, HandlerFunction>) {
  }

  handleMessage(type: string, payload: any) {
    if (!this.handlers[type]) {
      throw new Error(`No handler for message type: ${type} in domain: ${this.name}`);
    }
    this.handlers[type](payload);
  }
}

class WebSocketAPI {
  private domains = new Map<string, DomainAPI>();

  handleMessage(data: WebSocketMessage) {
    const domainAPI = this.requireDomainAPI(data.domain);
    domainAPI.handleMessage(data.type, data.payload);
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

function handleWebSocketMessage(data: WebSocketMessage) {
  websocketAPI.handleMessage(data);
} 

function registerDomainAPI(domainAPI: DomainAPI) {
  websocketAPI.registerDomain(domainAPI);
}

export {
  DomainAPI,
  handleWebSocketMessage,
  registerDomainAPI,
};

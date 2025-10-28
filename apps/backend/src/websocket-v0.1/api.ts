import { ClientWsActions, WsMessageHandler } from '@/websocket/types';
import { WsServerInbound } from '@common/types/websockets';

// -----------------------------------------------------------------------
// TODO: Message types can be client -> server and / or server -> client.
// The current architecture doens't reflect the "or" part.
// The "...MessagType" type defs should be split into two.
// -----------------------------------------------------------------------
class DomainAPI<TMessageType extends string = string> {
  constructor(
    public name: string,
    private handlers: Record<TMessageType, WsMessageHandler>,
  ) {}

  handleMessage(type: string, data: WsServerInbound, actions: ClientWsActions) {
    if (type in this.handlers) {
      this.handlers[type as TMessageType](data, actions);
    } else {
      // throw new Error(`No handler for message type: ${type} in domain: ${this.name}`);
      console.warn(
        `[ws-api] No handler for message type: ${type} in domain: ${this.name}`,
      );
    }
  }
}

class WebSocketAPI {
  private domains = new Map<string, DomainAPI>();

  handleMessage(data: WsServerInbound, actions: ClientWsActions) {
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

function handleWebSocketMessage(data: WsServerInbound, wsActions: ClientWsActions) {
  websocketAPI.handleMessage(data, wsActions);
}

function registerDomainAPI(domainAPI: DomainAPI) {
  console.log(`[ws-api] Registering domain: ${domainAPI.name}`);
  websocketAPI.registerDomain(domainAPI);
}

export { DomainAPI, handleWebSocketMessage, registerDomainAPI };

import type { WsServerInbound } from '@common/types/websockets';
import type { WsActions } from '@/websocket/types';

type DomainHandler = (data: WsServerInbound, actions: WsActions) => void;

class WsRouter {
  private domains = new Map<string, DomainHandler>();

  register(domain: string, handler: DomainHandler): void {
    if (this.domains.has(domain)) {
      throw new Error(`WS domain already registered: ${domain}`);
    }
    this.domains.set(domain, handler);
  }

  dispatch(data: WsServerInbound, actions: WsActions): void {
    const handler = this.domains.get(data.domain);
    if (!handler) {
      // Keep quiet in prod; dev can add logs as needed
      // console.debug('[ws-router] No handler for domain', data.domain, 'types:', Array.from(this.domains.keys()));
      return;
    }
    handler(data, actions);
  }
}

const wsRouter = new WsRouter();

function registerDomainHandler(domain: string, handler: DomainHandler): void {
  wsRouter.register(domain, handler);
}

function dispatchWebSocketMessage(
  data: WsServerInbound,
  actions: WsActions,
): void {
  wsRouter.dispatch(data, actions);
}

export { registerDomainHandler, dispatchWebSocketMessage };

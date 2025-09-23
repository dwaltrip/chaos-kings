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
    if (!handler) return;
    handler(data, actions);
  }
}

export { WsRouter, type DomainHandler };

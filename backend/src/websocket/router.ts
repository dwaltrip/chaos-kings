import type { WsServerInbound } from '@common/types/websockets';
import type { ClientWsActions } from '@/websocket/types';

type DomainName = string;
type DomainHandler = (data: WsServerInbound, actions: ClientWsActions) => void;

class WsRouter {
  private domains = new Map<DomainName, DomainHandler>();

  register(domain: DomainName, handler: DomainHandler): void {
    if (this.domains.has(domain)) {
      throw new Error(`WS domain already registered: ${domain}`);
    }
    this.domains.set(domain, handler);
  }

  dispatch(data: WsServerInbound, actions: ClientWsActions): void {
    const domainHandler = this.domains.get(data.domain);
    if (!domainHandler) {
      throw new Error(`No handler registered for WS domain: ${data.domain}`);
    }
    domainHandler(data, actions);
  }
}

export { WsRouter, type DomainHandler };

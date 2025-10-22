import type { User } from '@common/types/user';

// Base envelopes with clear direction semantics
// - WsClientEnvelope: client → server messages (no user attached)
// - WsServerInbound: hydrated on server (client → server + user)
// - WsServerOutbound: server → client messages
interface WsClientEnvelope {
  domain: string;
  type: string;
  payload: any;
}

interface WsServerInbound extends WsClientEnvelope {
  user: User;
}

interface WsServerOutbound {
  domain: string;
  type: string;
  payload: any;
}

interface WsDomainHandler {
  handleMessage: (data: WsServerOutbound) => void;
}

export type { WsClientEnvelope, WsServerInbound, WsServerOutbound, WsDomainHandler };

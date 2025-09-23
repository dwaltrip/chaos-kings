import { WsServerInbound, WsServerOutbound } from '@common/types/websockets';

type WsClientId = string;

interface ClientWsActions {
  join: (roomId: string) => void;
  leave: (roomId: string) => void;
  reply: (data: WsServerOutbound) => void;
  broadcast: (roomId: string, data: WsServerOutbound) => void;
}

type WsMessageHandler = (
  data: WsServerInbound,
  actions: ClientWsActions,
) => void;

export {
  type WsClientId,
  type ClientWsActions,
  type WsMessageHandler,
  type WsServerInbound,
  type WsServerOutbound,
};

import { WsServerInbound, WsServerOutbound } from '@common/types/websockets';

type WsClientId = string;

interface WsActions {
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendToSelf: (data: WsServerOutbound) => void;
  broadcastToRoom: (roomId: string, data: WsServerOutbound) => void;
}

type WsMessageHandler = (data: WsServerInbound, actions: WsActions) => void;

export {
  type WsClientId,
  type WsActions,
  type WsMessageHandler,
  type WsServerInbound,
  type WsServerOutbound,
};

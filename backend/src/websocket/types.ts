import { WsMessage } from '@common/types/websockets';

type WsClientId = string;

interface WsActions {
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendToSelf: (data: WsMessage) => void;
  sendToClient: (clientId: WsClientId, message: any) => void;
  broadcastToRoom: (roomId: string, data: WsMessage) => void;
}

type WsMessageHandler = (data: WsMessage, actions: WsActions) => void;

export {
  type WsClientId,
  type WsActions,
  type WsMessageHandler,
  type WsMessage,
};

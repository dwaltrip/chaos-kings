import { WsMessage } from '../../../common/types/websockets';

type WsClientId = string;

interface WsActions {
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendToSelf: (message: any) => void;
  sendToClient: (clientId: WsClientId, message: any) => void;
  broadcastToRoom: (roomId: string, message: any) => void;
}

type WsMessageHandler = (payload: any, actions: WsActions) => void;

export {
  type WsClientId,
  type WsActions,
  type WsMessageHandler,
  type WsMessage,
};

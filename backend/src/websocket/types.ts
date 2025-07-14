type WsClientId = string;

interface WsActions {
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendToSelf: (message: any) => void;
  sendToClient: (clientId: WsClientId, message: any) => void;
  broadcastToRoom: (roomId: string, message: any) => void;
}

export {
  type WsClientId,
  type WsActions,
};

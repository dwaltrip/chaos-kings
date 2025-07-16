import {
  WebSocketManager,
  handleWebSocketMessage,
  WsMessageHandler,
} from './websocket';

const PORT = 8080;

new WebSocketManager(
  PORT,
  (data, wsActions) => {
    handleWebSocketMessage(data, wsActions);
  }
);


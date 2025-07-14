import {
  WebSocketManager,
  handleWebSocketMessage,
  WsMessageHandler,
} from './websocket';

const PORT = 8080;

new WebSocketManager(
  PORT,
  (data, actions) => {
    handleWebSocketMessage(data, actions);
  }
);


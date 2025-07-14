import { WebSocketManager } from './services/websocket-v2';
import { handleWebSocketMessage } from './websocket-api';

const PORT = 8080;

const webSocketManager = new WebSocketManager(
  PORT,
  (client, data, manager) => {
    handleWebSocketMessage(data);
  }
);


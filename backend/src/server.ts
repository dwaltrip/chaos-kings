import {
  WebSocketManager,
  handleWebSocketMessage,
} from './websocket';

import { registerDomainAPI } from './websocket/api';
import { GameChatWsAPI } from './game-chat/game-chat-ws-api';

const PORT = 8080;

new WebSocketManager(
  PORT,
  (data, wsActions) => {
    handleWebSocketMessage(data, wsActions);
  }
);

registerDomainAPI(GameChatWsAPI);

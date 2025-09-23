import { WebSocketManager } from '@/websocket/manager';
import {
  registerDomainHandler,
  dispatchWebSocketMessage,
} from '@/websocket/router';
import { WsMessageHandler } from '@/websocket/types';

export {
  WebSocketManager,
  registerDomainHandler,
  dispatchWebSocketMessage,
  type WsMessageHandler,
};

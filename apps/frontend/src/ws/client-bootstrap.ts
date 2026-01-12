import { ConnectionState } from '@/ws-lib';
import type { HandlerMap } from '@/ws-lib';
import { WSClient } from '@/ws-lib/client';
import { useWsConnectionStore } from '@/ws-lib/connection-store';

import { wsBridge } from '@/ws/client-bridge-bootstrap';
import type { ClientMessage, ServerMessage } from '@/ws/message-types';

import { chatHandlers } from '@/domains/chat/handlers';
import { gameplayHandlers } from '@/domains/gameplay/handlers';
import { matchmakingHandlers } from '@/domains/matchmaking/handlers';
import { puzzlesHandlers } from '@/domains/puzzles/handlers';
import { systemHandlers } from '@/domains/system/handlers';

const mergedHandlers = {
  ...chatHandlers,
  ...matchmakingHandlers,
  ...gameplayHandlers,
  ...puzzlesHandlers,
  ...systemHandlers,
} satisfies HandlerMap<ServerMessage>;

let clientInstance: WSClient<ServerMessage, ClientMessage> | null = null;

// TODO: use env vars / config for this
const DEFAULT_WS_URL = 'ws://localhost:3131/ws';

function resolveWsUrl() {
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
    return import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL;
  }

  return DEFAULT_WS_URL;
}

function initializeWsClient() {
  if (clientInstance) {
    return clientInstance;
  }

  const store = useWsConnectionStore.getState();
  const wsUrl = resolveWsUrl();

  clientInstance = new WSClient<ServerMessage, ClientMessage>(wsUrl, mergedHandlers, {
    reconnect: true,
    maxReconnectAttempts: 10,
    reconnectInterval: 1000,
    onStateChange: (state) => {
      store.setReadyState(state);
    },
    onReconnectAttempt: (attempt) => {
      store.setReconnectAttempts(attempt);
      if (attempt > 0) {
        store.setReadyState(ConnectionState.CONNECTING);
      }
    },
  });

  wsBridge.init(clientInstance);

  return clientInstance;
}

function resetWsClientForTests() {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }

  wsBridge.reset();

  const store = useWsConnectionStore.getState();
  store.setReadyState(ConnectionState.CLOSED);
  store.setReconnectAttempts(0);
}

export { resetWsClientForTests, initializeWsClient };

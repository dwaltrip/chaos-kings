import { WebSocketManager } from './manager';

let globalWebSocketManager: WebSocketManager | null = null;

export function setGlobalWebSocketManager(manager: WebSocketManager): void {
  globalWebSocketManager = manager;
}

export function getGlobalWebSocketManager(): WebSocketManager {
  if (!globalWebSocketManager) {
    throw new Error(
      'Global WebSocketManager not initialized. Call setGlobalWebSocketManager() first.',
    );
  }
  return globalWebSocketManager;
}

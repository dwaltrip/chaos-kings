import { type WsMessage } from '@common/types/websockets';
import { invariant } from '@common/utils/invariant';
import { wsStore } from '@/services/ws-store';

interface WsMessageHandler {
  handleMessage: (message: WsMessage) => void;
}

// Exclude 'message' event as it is handled separately
type EventNames = 'open' | 'close' | 'error';
type EventTypes = MessageEvent | CloseEvent | Event;
type WsEventListener = (event: EventTypes) => void;
type EventListeners = { [key in EventNames]?: WsEventListener[] };

class WebSocketService {
  private ws: WebSocket;
  private url: string;
  private _store = wsStore;
  private _currentRoom?: string;

  private listeners: EventListeners = {};
  private messageHandlers: Map<string, WsMessageHandler[]> = new Map();

  // TODO: move URL to config
  constructor(url: string = 'ws://localhost:3131/ws') {
    console.log('[ws-service] Initializing WebSocketService');
    this.url = url;
    this.ws = new WebSocket(this.url);
    this._store.getState().setReadyState(WebSocket.CONNECTING);

    this.ws.onopen = (event) => {
      console.log(`[ws-service] connection established to ${this.url}`);
      this._store.getState().setReadyState(WebSocket.OPEN);
      this.listeners.open?.forEach((listener) => listener(event));
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const wsMessage = message as WsMessage;
        invariant(
          'domain' in message,
          'WebSocket message must have a domain property',
        );

        this.getMessageHandlers(wsMessage.domain).forEach((listener) => {
          listener.handleMessage(wsMessage);
        });
      } catch (error) {
        console.error('[ws-service] Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[ws-service] connection closed:`, event);
      this._store.getState().setReadyState(WebSocket.CLOSED);
      this.listeners.close?.forEach((listener) => listener(event));
    };

    this.ws.onerror = (error) => {
      console.error(`[ws-service] WebSocket error:`, error);
      this.listeners.error?.forEach((listener) => listener(error));
    };

    window.addEventListener('beforeunload', this.handleUnload);
  }

  private handleUnload = () => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  };

  async onReadyOrNow(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isConnected) {
        resolve();
      } else {
        this.addListener('open', () => {
          resolve();
        });
      }
    });
  }

  send(message: WsMessage) {
    // TODO: queue messages if not connected
    if (!this.isConnected) {
      console.error(`[ws-service] cannot send message: Not connected`, message);
      return;
    }

    try {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
    } catch (error) {
      console.error(`[ws-service] failed to send message:`, error);
    }
  }

  get isConnected(): boolean {
    // ---------------------------------------------------------------------------------------
    // ---------------------------------------------------------------------------------------
    // TODO: is this reactive / correctly selecting only on the one property (getIsConnected)?
    // E.g. if I use this in a component, will it re-render on connection state change?
    // ---------------------------------------------------------------------------------------
    // ---------------------------------------------------------------------------------------
    return this._store.getState().getIsConnected();
  }
  get isConnectedOrConnecting(): boolean {
    return this._store.getState().getIsConnectedOrConnecting();
  }

  get currentRoom(): string | undefined {
    return this._currentRoom;
  }

  // TODO: what about `domain`????
  addListener(type: EventNames, listener: WsEventListener) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  getMessageHandlers(domain: string): WsMessageHandler[] {
    return this.messageHandlers.get(domain) || [];
  }

  addMessageHandler(domain: string, handler: WsMessageHandler) {
    const handlers = this.messageHandlers.get(domain) ?? [];
    handlers.push(handler);
    this.messageHandlers.set(domain, handlers);
  }

  removeMessageHandler(domain: string, handler: WsMessageHandler) {
    const handlers = this.messageHandlers.get(domain);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        console.log(
          `[ws-service] Message handler removed for domain: ${domain}`,
        );
      }
    }
  }
}

let globalWebSocketService: WebSocketService | null = null;

function getWebSocketService(url?: string): WebSocketService {
  if (!globalWebSocketService) {
    globalWebSocketService = new WebSocketService(url);
  }
  return globalWebSocketService;
}

export { getWebSocketService, type WsMessage };

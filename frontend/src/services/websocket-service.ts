// TODO: create alias for top-level shared "types" directory
import { type WsMessage } from '../../../types/websockets';
import { WsStore } from './ws-store';

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
  private _store = WsStore;
  private _currentRoom?: string;

  private listeners: EventListeners = {};
  private messageHandlers: Map<string, WsMessageHandler[]> = new Map();

  constructor(url: string = 'ws://localhost:8080') {
    this.url = url;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = (event) => {
      console.log(`[ws-service] WebSocket connection established to ${this.url}`);
      this._store.setIsConnected(true);
      this.listeners.open?.forEach(listener => listener(event));
    };

    this.ws.onmessage = (event) => {
      console.log(`[ws-service] WebSocket message received:`, event.data);
      const message: WsMessage = JSON.parse(event.data);
      this.getMessageHandlers(message.domain).forEach(listener => {
        listener.handleMessage(message);
      });
    };

    this.ws.onclose = (event) => {
      console.log(`[ws-service] WebSocket connection closed:`, event);
      this._store.setIsConnected(false);
      this.listeners.close?.forEach(listener => listener(event));
    };

    this.ws.onerror = (error) => {
      console.error(`[ws-service] WebSocket error:`, error);
      this.listeners.error?.forEach(listener => listener(error));
    };

    window.addEventListener('beforeunload', this.handleUnload);
  }

  private handleUnload = () => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  };

  send(message: any) {
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
    return this._store.getState().isConnected
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
    if (!this.messageHandlers.has(domain)) {
      this.messageHandlers.set(domain, []);
    }
    this.messageHandlers.get(domain)?.push(handler);
  }

  removeMessageHandler(domain: string, handler: WsMessageHandler) {
    const handlers = this.messageHandlers.get(domain);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        console.log(`[ws-service] Message handler removed for domain: ${domain}`);
      }
    }
  }

  cleanup() {
    // TODO: not sure what should go here as this is a singleton service
    console.log('[ws-service] Cleaning up WebSocket service');
    // if (this.ws) {
    //   this.ws.close();
    //   this.ws = null as any; // Clear the reference
    // }
    // window.removeEventListener('beforeunload', this.handleUnload);
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

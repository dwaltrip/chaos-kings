interface WsMessage {
  user: string;
  message: string;
  timestamp: number;
}

class WebSocketService {
  private ws: WebSocket;
  private url: string;
  private _isConnected: boolean = false;
  private _currentRoom?: string;

  constructor(url: string = 'ws://localhost:8080') {
    this.url = url;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = (event) => {
      this._isConnected = true;
    };

    this.ws.onmessage = (event) => {
      const message: WsMessage = JSON.parse(event.data);
    };

    this.ws.onclose = (event) => {
      this._isConnected = false;
    };

    this.ws.onerror = (error) => {
      console.error(`[WS-Service] ❌ WebSocket error:`, error);
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
    return this._isConnected;
  }
  get currentRoom(): string | undefined {
    return this._currentRoom;
  }

  cleanup() {
    if (this.ws) {
      this.ws.close();
      this.ws = null as any; // Clear the reference
    }
    window.removeEventListener('beforeunload', this.handleUnload);
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

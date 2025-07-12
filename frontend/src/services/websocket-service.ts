interface WsMessage {
  user: string;
  message: string;
  timestamp: number;
}

interface RoomMessage extends WsMessage {
  room: string;
  type: 'chat' | 'join' | 'leave';
}

interface MatchmakingMessage {
  type: 'join-queue' | 'leave-queue' | 'queue-status' | 'queue-status-update' | 'game-found';
  playerId: string;
  playerData?: {
    username: string;
    level: number;
  };
  queueSize?: number;
  playersInQueue?: string[];
  playersNeeded?: number;
  gameId?: string;
}

type WebSocketMessage = RoomMessage | MatchmakingMessage;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private isConnected: boolean = false;
  private roomMessageListeners: Set<(message: RoomMessage) => void> = new Set();
  private matchmakingMessageListeners: Set<(message: MatchmakingMessage) => void> = new Set();
  private connectionStateListeners: Set<(isConnected: boolean) => void> = new Set();
  private currentRoom?: string;

  constructor(url: string = 'ws://localhost:8080') {
    this.url = url;
    console.log(`[WS-Service] Initializing WebSocket connection to ${url}`);
    this.connect();
  }

  private connect() {
    console.log(`[WS-Service] Attempting to connect to ${this.url}`);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.isConnected = true;
      console.log(`[WS-Service] ✅ Connected to WebSocket server at ${this.url}`);
      console.log(`[WS-Service] Notifying ${this.connectionStateListeners.size} connection listeners`);
      this.connectionStateListeners.forEach(listener => listener(true));
    };

    this.ws.onmessage = (event) => {
      try {
        console.log(`[WS-Service] Raw message received:`, event.data);
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log(`[WS-Service] Parsed message:`, message);
        
        if ('room' in message) {
          console.log(`[WS-Service] Routing room message (${message.type}) to ${this.roomMessageListeners.size} chat listeners`);
          let deliveredCount = 0;
          this.roomMessageListeners.forEach(listener => {
            try {
              listener(message as RoomMessage);
              deliveredCount++;
            } catch (error) {
              console.error(`[WS-Service] Error delivering room message to listener:`, error);
            }
          });
          console.log(`[WS-Service] Room message delivered to ${deliveredCount} listeners`);
        } else if ('type' in message && (message.type === 'queue-status-update' || message.type === 'game-found' || 'playerId' in message)) {
          console.log(`[WS-Service] Routing matchmaking message (${message.type}) to ${this.matchmakingMessageListeners.size} matchmaking listeners`);
          let deliveredCount = 0;
          this.matchmakingMessageListeners.forEach(listener => {
            try {
              listener(message as MatchmakingMessage);
              deliveredCount++;
            } catch (error) {
              console.error(`[WS-Service] Error delivering matchmaking message to listener:`, error);
            }
          });
          console.log(`[WS-Service] Matchmaking message delivered to ${deliveredCount} listeners`);
        } else {
          console.warn(`[WS-Service] ⚠️ Unknown message format:`, message);
        }
      } catch (error) {
        console.error(`[WS-Service] ❌ Error parsing WebSocket message:`, error);
        console.error(`[WS-Service] Raw data:`, event.data);
      }
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      console.log(`[WS-Service] ❌ Disconnected from WebSocket server (code: ${event.code}, reason: ${event.reason})`);
      console.log(`[WS-Service] Notifying ${this.connectionStateListeners.size} connection listeners of disconnect`);
      this.connectionStateListeners.forEach(listener => listener(false));
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

  send(message: WebSocketMessage) {
    console.log(`[WS-Service] Attempting to send message:`, message);
    
    if (!this.ws) {
      console.error(`[WS-Service] ❌ Cannot send message: WebSocket is null`);
      return;
    }
    
    if (!this.isConnected) {
      console.error(`[WS-Service] ❌ Cannot send message: Not connected (readyState: ${this.ws.readyState})`);
      return;
    }
    
    try {
      const messageStr = JSON.stringify(message);
      console.log(`[WS-Service] Sending serialized message:`, messageStr);
      this.ws.send(messageStr);
      console.log(`[WS-Service] ✅ Message sent successfully`);
    } catch (error) {
      console.error(`[WS-Service] ❌ Failed to send message:`, error);
    }
  }

  addRoomMessageListener(listener: (message: RoomMessage) => void) {
    console.log(`[WS-Service] Adding room message listener (total: ${this.roomMessageListeners.size + 1})`);
    this.roomMessageListeners.add(listener);
    return () => {
      console.log(`[WS-Service] Removing room message listener (total: ${this.roomMessageListeners.size - 1})`);
      this.roomMessageListeners.delete(listener);
    };
  }

  addMatchmakingMessageListener(listener: (message: MatchmakingMessage) => void) {
    console.log(`[WS-Service] Adding matchmaking message listener (total: ${this.matchmakingMessageListeners.size + 1})`);
    this.matchmakingMessageListeners.add(listener);
    return () => {
      console.log(`[WS-Service] Removing matchmaking message listener (total: ${this.matchmakingMessageListeners.size - 1})`);
      this.matchmakingMessageListeners.delete(listener);
    };
  }

  addConnectionStateListener(listener: (isConnected: boolean) => void) {
    console.log(`[WS-Service] Adding connection state listener (total: ${this.connectionStateListeners.size + 1})`);
    this.connectionStateListeners.add(listener);
    console.log(`[WS-Service] Immediately calling new connection listener with current state: ${this.isConnected}`);
    listener(this.isConnected); // Call immediately with current state
    return () => {
      console.log(`[WS-Service] Removing connection state listener (total: ${this.connectionStateListeners.size - 1})`);
      this.connectionStateListeners.delete(listener);
    };
  }

  getConnectionState(): boolean {
    return this.isConnected;
  }

  getCurrentRoom(): string | undefined {
    return this.currentRoom;
  }

  setCurrentRoom(room: string | undefined) {
    this.currentRoom = room;
  }

  disconnect() {
    window.removeEventListener('beforeunload', this.handleUnload);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

let globalWebSocketService: WebSocketService | null = null;

export function getWebSocketService(url?: string): WebSocketService {
  if (!globalWebSocketService) {
    globalWebSocketService = new WebSocketService(url);
  }
  return globalWebSocketService;
}

export type { RoomMessage, MatchmakingMessage, WsMessage };
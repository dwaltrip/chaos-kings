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
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.connectionStateListeners.forEach(listener => listener(true));
      console.log('Connected to WebSocket server');
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('Received WebSocket message:', message);
        
        if ('room' in message) {
          console.log('Routing to chat listeners');
          this.roomMessageListeners.forEach(listener => listener(message as RoomMessage));
        } else if ('type' in message && (message.type === 'queue-status-update' || message.type === 'game-found' || 'playerId' in message)) {
          console.log('Routing to matchmaking listeners');
          this.matchmakingMessageListeners.forEach(listener => listener(message as MatchmakingMessage));
        } else {
          console.log('Unknown message format:', message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.connectionStateListeners.forEach(listener => listener(false));
      console.log('Disconnected from WebSocket server');
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    window.addEventListener('beforeunload', this.handleUnload);
  }

  private handleUnload = () => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  };

  send(message: WebSocketMessage) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  addRoomMessageListener(listener: (message: RoomMessage) => void) {
    this.roomMessageListeners.add(listener);
    return () => this.roomMessageListeners.delete(listener);
  }

  addMatchmakingMessageListener(listener: (message: MatchmakingMessage) => void) {
    this.matchmakingMessageListeners.add(listener);
    return () => this.matchmakingMessageListeners.delete(listener);
  }

  addConnectionStateListener(listener: (isConnected: boolean) => void) {
    this.connectionStateListeners.add(listener);
    listener(this.isConnected); // Call immediately with current state
    return () => this.connectionStateListeners.delete(listener);
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
import { WebSocketServer, WebSocket } from 'ws';
import { MatchmakingQueue } from './src/matchmaking-example';
import { getClient } from './src/services/redis';

interface ChatMessage {
  user: string;
  message: string;
  timestamp: number;
}

interface RoomMessage extends ChatMessage {
  room: string;
  type: 'chat' | 'join' | 'leave';
}

interface MatchmakingMessage {
  type: 'join-queue' | 'leave-queue' | 'queue-status';
  playerId: string;
  playerData?: {
    username?: string;
    level?: number;
    [key: string]: any;
  };
}

type WebSocketMessage = RoomMessage | MatchmakingMessage;

interface ClientData {
  ws: WebSocket;
  room?: string;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private rooms = new Map<string, Set<WebSocket>>();
  private clients = new Map<WebSocket, ClientData>();
  private matchmakingQueue: MatchmakingQueue | null = null;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.initializeMatchmaking();
    this.setupEventHandlers();
    console.log(`WebSocket server running on ws://localhost:${port}`);
  }

  private async initializeMatchmaking() {
    try {
      const redis = await getClient();
      this.matchmakingQueue = new MatchmakingQueue(redis, 4); // 4 players per game
      console.log('Matchmaking queue initialized');
    } catch (error) {
      console.error('Failed to initialize matchmaking queue:', error);
    }
  }

  private setupEventHandlers() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New client connected');
      
      this.clients.set(ws, { ws });

      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          console.log('Received:', message);

          if ('room' in message) {
            // Handle room-based messages (chat)
            if (message.type === 'join') {
              this.joinRoom(ws, message.room);
            } else if (message.type === 'leave') {
              this.leaveRoom(ws, message.room);
            } else if (message.type === 'chat') {
              this.broadcastToRoom(message.room, message);
            }
          } else {
            // Handle matchmaking messages
            this.handleMatchmakingMessage(ws, message as MatchmakingMessage);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        const clientData = this.clients.get(ws);
        if (clientData?.room) {
          this.leaveRoom(ws, clientData.room);
        }
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private joinRoom(ws: WebSocket, roomId: string) {
    const clientData = this.clients.get(ws);
    if (!clientData) return;

    // Leave current room if in one
    if (clientData.room) {
      this.leaveRoom(ws, clientData.room);
    }

    // Join new room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(ws);
    clientData.room = roomId;
    
    console.log(`Client joined room: ${roomId}`);
  }

  private leaveRoom(ws: WebSocket, roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
    
    const clientData = this.clients.get(ws);
    if (clientData) {
      clientData.room = undefined;
    }
    
    console.log(`Client left room: ${roomId}`);
  }

  private broadcastToRoom(roomId: string, message: RoomMessage) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    room.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  private broadcastToAllClients(message: any) {
    this.clients.forEach((clientData, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  private async handleMatchmakingMessage(ws: WebSocket, message: MatchmakingMessage) {
    console.log('Handling matchmaking message:', message);
    
    if (!this.matchmakingQueue) {
      console.error('Matchmaking queue not initialized');
      return;
    }
    
    try {
      switch (message.type) {
        case 'join-queue':
          console.log(`Player ${message.playerId} wants to join queue`);
          const game = await this.matchmakingQueue.addPlayer(message.playerId, message.playerData);
          if (game) {
            console.log('Game created:', game);
            // Broadcast game creation to all clients
            this.broadcastToAllClients({ 
              type: 'game-found', 
              gameId: game.gameId,
              players: game.players.map(p => p.playerId)
            });
          }
          // Broadcast updated queue status to all clients
          const queueStatus = await this.matchmakingQueue.getQueueStatus();
          this.broadcastToAllClients({ type: 'queue-status-update', ...queueStatus });
          break;
          
        case 'leave-queue':
          console.log(`Player ${message.playerId} wants to leave queue`);
          await this.matchmakingQueue.removePlayer(message.playerId);
          // Broadcast updated queue status to all clients
          const updatedStatus = await this.matchmakingQueue.getQueueStatus();
          this.broadcastToAllClients({ type: 'queue-status-update', ...updatedStatus });
          break;
          
        case 'queue-status':
          console.log(`Player ${message.playerId} requested queue status`);
          const status = await this.matchmakingQueue.getQueueStatus();
          ws.send(JSON.stringify({ type: 'queue-status-update', ...status }));
          break;
          
        default:
          console.log('Unknown matchmaking message type');
      }
    } catch (error) {
      console.error('Error handling matchmaking message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to handle matchmaking request' }));
    }
  }
}
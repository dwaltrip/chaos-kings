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
  playerId?: string;
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
    this.wss.on('connection', async (ws: WebSocket) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[${clientId}] New client connected`);
      
      this.clients.set(ws, { ws });
      
      // Send initial queue status to new client
      if (this.matchmakingQueue) {
        try {
          const initialStatus = await this.matchmakingQueue.getQueueStatus();
          console.log(`[${clientId}] Sending initial queue status:`, initialStatus);
          ws.send(JSON.stringify({ type: 'queue-status-update', ...initialStatus }));
        } catch (error) {
          console.error(`[${clientId}] Error sending initial queue status:`, error);
        }
      }

      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          console.log(`[${clientId}] Raw message received:`, data.toString());
          console.log(`[${clientId}] Parsed message:`, message);

          if ('room' in message) {
            console.log(`[${clientId}] Processing room-based message:`, message.type);
            // Handle room-based messages (chat)
            if (message.type === 'join') {
              console.log(`[${clientId}] Handling join room: ${message.room}`);
              this.joinRoom(ws, message.room, clientId);
            } else if (message.type === 'leave') {
              console.log(`[${clientId}] Handling leave room: ${message.room}`);
              this.leaveRoom(ws, message.room, clientId);
            } else if (message.type === 'chat') {
              console.log(`[${clientId}] Handling chat message in room ${message.room}: "${message.message}" from ${message.user}`);
              this.broadcastToRoom(message.room, message, clientId);
            }
          } else {
            console.log(`[${clientId}] Processing matchmaking message:`, message.type);
            // Handle matchmaking messages
            this.handleMatchmakingMessage(ws, message as MatchmakingMessage);
          }
        } catch (error) {
          console.error(`[${clientId}] Error parsing message:`, error);
          console.error(`[${clientId}] Raw data:`, data.toString());
        }
      });

      ws.on('close', async () => {
        console.log(`[${clientId}] Client disconnected`);
        const clientData = this.clients.get(ws);
        
        // Remove from chat room if in one
        if (clientData?.room) {
          console.log(`[${clientId}] Removing from room ${clientData.room} on disconnect`);
          this.leaveRoom(ws, clientData.room, clientId);
        }
        
        // Remove from matchmaking queue if in one
        if (clientData?.playerId && this.matchmakingQueue) {
          console.log(`[${clientId}] Removing disconnected player ${clientData.playerId} from queue`);
          try {
            await this.matchmakingQueue.removePlayer(clientData.playerId);
            // Broadcast updated queue status to remaining clients
            const updatedStatus = await this.matchmakingQueue.getQueueStatus();
            console.log(`[${clientId}] Broadcasting queue status update after disconnect:`, updatedStatus);
            this.broadcastToAllClients({ type: 'queue-status-update', ...updatedStatus });
          } catch (error) {
            console.error(`[${clientId}] Error removing disconnected player from queue:`, error);
          }
        }
        
        this.clients.delete(ws);
        console.log(`[${clientId}] Client cleanup completed`);
      });

      ws.on('error', (error) => {
        console.error(`[${clientId}] WebSocket error:`, error);
      });
    });
  }

  private joinRoom(ws: WebSocket, roomId: string, clientId?: string) {
    const logPrefix = clientId ? `[${clientId}]` : '';
    const clientData = this.clients.get(ws);
    if (!clientData) {
      console.log(`${logPrefix} Cannot join room ${roomId}: client data not found`);
      return;
    }

    // Leave current room if in one
    if (clientData.room) {
      console.log(`${logPrefix} Leaving current room ${clientData.room} before joining ${roomId}`);
      this.leaveRoom(ws, clientData.room, clientId);
    }

    // Join new room
    if (!this.rooms.has(roomId)) {
      console.log(`${logPrefix} Creating new room: ${roomId}`);
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(ws);
    clientData.room = roomId;
    
    const roomSize = this.rooms.get(roomId)!.size;
    console.log(`${logPrefix} Client joined room: ${roomId} (room now has ${roomSize} clients)`);
  }

  private leaveRoom(ws: WebSocket, roomId: string, clientId?: string) {
    const logPrefix = clientId ? `[${clientId}]` : '';
    const room = this.rooms.get(roomId);
    if (room) {
      const wasInRoom = room.has(ws);
      room.delete(ws);
      if (room.size === 0) {
        console.log(`${logPrefix} Room ${roomId} is now empty, deleting it`);
        this.rooms.delete(roomId);
      } else {
        console.log(`${logPrefix} Room ${roomId} now has ${room.size} clients`);
      }
      
      if (!wasInRoom) {
        console.log(`${logPrefix} Warning: Client was not actually in room ${roomId}`);
      }
    } else {
      console.log(`${logPrefix} Warning: Tried to leave non-existent room ${roomId}`);
    }
    
    const clientData = this.clients.get(ws);
    if (clientData) {
      clientData.room = undefined;
      console.log(`${logPrefix} Client left room: ${roomId}`);
    } else {
      console.log(`${logPrefix} Warning: Client data not found when leaving room ${roomId}`);
    }
  }

  private broadcastToRoom(roomId: string, message: RoomMessage, clientId?: string) {
    const logPrefix = clientId ? `[${clientId}]` : '';
    const room = this.rooms.get(roomId);
    if (!room) {
      console.log(`${logPrefix} Cannot broadcast to room ${roomId}: room does not exist`);
      return;
    }
    
    console.log(`${logPrefix} Broadcasting message to room ${roomId} with ${room.size} clients:`, message);
    
    let sentCount = 0;
    let skippedCount = 0;
    
    room.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          const messageStr = JSON.stringify(message);
          client.send(messageStr);
          sentCount++;
          console.log(`${logPrefix} Message sent to client in room ${roomId}`);
        } catch (error) {
          console.error(`${logPrefix} Failed to send message to client in room ${roomId}:`, error);
          skippedCount++;
        }
      } else {
        console.log(`${logPrefix} Skipping client in room ${roomId} - connection not open (readyState: ${client.readyState})`);
        skippedCount++;
      }
    });
    
    console.log(`${logPrefix} Broadcast complete for room ${roomId}: ${sentCount} sent, ${skippedCount} skipped`);
  }

  private broadcastToAllClients(message: any) {
    console.log(`Broadcasting to all clients (${this.clients.size} total):`, message);
    
    let sentCount = 0;
    let skippedCount = 0;
    
    this.clients.forEach((clientData, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error('Failed to send broadcast message to client:', error);
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    });
    
    console.log(`Broadcast complete: ${sentCount} sent, ${skippedCount} skipped`);
  }

  private async handleMatchmakingMessage(ws: WebSocket, message: MatchmakingMessage) {
    console.log('Handling matchmaking message:', message);
    
    if (!this.matchmakingQueue) {
      console.error('Matchmaking queue not initialized');
      ws.send(JSON.stringify({ type: 'error', message: 'Matchmaking not available' }));
      return;
    }
    
    try {
      switch (message.type) {
        case 'join-queue':
          console.log(`Player ${message.playerId} wants to join queue`);
          // Track this player for disconnect handling
          const clientData = this.clients.get(ws);
          if (clientData) {
            clientData.playerId = message.playerId;
          }
          
          const game = await this.matchmakingQueue.addPlayer(message.playerId, message.playerData);
          if (game) {
            console.log('Game created:', game);
            // Clear playerIds for all clients that were in the game
            this.clients.forEach((data, client) => {
              if (game.players.some(p => p.playerId === data.playerId)) {
                data.playerId = undefined;
              }
            });
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
          // Clear playerId tracking
          const leavingClientData = this.clients.get(ws);
          if (leavingClientData) {
            leavingClientData.playerId = undefined;
          }
          
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
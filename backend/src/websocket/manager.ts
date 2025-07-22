import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { WsClientId, WsActions, WsMessageHandler, WsMessage } from '@/websocket/types';

type RoomId = string;

interface WsClient {
  id: WsClientId
  ws: WebSocket;
  currentRoom: RoomId | null;
  user?: any;
}

function createWsClient(ws: WebSocket): WsClient {
  const id = `client-${uuidv4()}`;
  return { id, ws, currentRoom: null };
}

class ClientStore {
  private clientsById = new Map<WsClientId, WsClient>();
  private clientsBySocket = new Map<WebSocket, WsClient>();

  addClient(ws: WebSocket): WsClient {
    const client = createWsClient(ws);
    this.clientsById.set(client.id, client);
    this.clientsBySocket.set(ws, client);
    return client;
  }

  removeClient(client: WsClient) {
    this.clientsBySocket.delete(client.ws);
    this.clientsById.delete(client.id);
  }

  getById(id: WsClientId): WsClient {
    const client = this.clientsById.get(id);
    if (!client) {
      throw new Error(`Client with ID ${id} not found`);
    }
    return client;
  }

  getBySocket(ws: WebSocket): WsClient {
    const client = this.clientsBySocket.get(ws);
    if (!client) {
      throw new Error(`Client with given WebSocket not found`);
    }
    return client;
  }

  forEach(callback: (client: WsClient) => void) {
    this.clientsById.forEach(callback);
  }

  get size(): number {
    return this.clientsById.size;
  }
}

function clientLogger(client: WsClient) {
  const userStr = (client.user ? `${client.user}` : '-');
  const prefix = `[${client.id.slice(0, 20)}..., ${userStr}]`.padEnd(40, ' ');
  return {
    log: (...args: any[]) => console.log(prefix, ...args),
    error: (...args: any[]) => console.error(prefix, ...args),
  };
}

class WebSocketManager {
  private wss: WebSocketServer;
  private rooms = new Map<string, Set<WsClient>>();
  clientStore = new ClientStore();

  constructor(
    port: number,
    private handleMessage: WsMessageHandler,
  ) {
    this.wss = new WebSocketServer({ port });
    console.log(`WebSocket server running on ws://localhost:${port}`);
    console.log('='.repeat(80));
    console.log();
    this.setupHandlers();
  }

  private setupHandlers() {
    this.wss.on('connection', async (ws: WebSocket) => {
      const client = this.clientStore.addClient(ws);
      const logger = clientLogger(client);
      console.log('-'.repeat(80));
      logger.log('New client connected');
      
      ws.on('message', (buffer: Buffer) => {
        const bufferStr = buffer.toString();
        try {
          const message = validateMessage(JSON.parse(bufferStr));
          if (message.user) {
            client.user = message.user;
            // logger.log(`Client user set to: ${client.user}`);
          }
          logger.log('Received:', message);
          this.handleMessage(message, this.actionsForClient(client));
        }
        catch (error) {
          logger.error('Error parsing message:', error, '-- data:', bufferStr);
        }
      });

      ws.on('close', async () => {
        logger.log('Client disconnected');
        this.clientStore.removeClient(client);
        logger.log('Client cleanup completed');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });
  }

  private actionsForClient(client: WsClient): WsActions {
    return {
      joinRoom: (roomId: string) => this.joinRoom(client, roomId),
      leaveRoom: (roomId: string) => this.leaveRoom(client, roomId),
      broadcastToRoom: (roomId: string, message: any) => {
        this.broadcastToRoom(roomId, message, client);
      },
      sendToSelf: (message: any) => client.ws.send(message),
      sendToClient: (clientId: WsClientId, message: any) => {
        this.clientStore.getById(clientId).ws.send(message);
      },
      // broadcastToAllClients: (message: any) => this.broadcastToAllClients(message),
    };
  }

  private joinRoom(client: WsClient, roomId: string) {
    if (client.currentRoom) {
      this.leaveRoom(client, client.currentRoom);
    }
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(client);
    client.currentRoom = roomId;
    console.log(`Client (${client.user}, ${client.id}) joined room: ${roomId}`);
  }

  private leaveRoom(client: WsClient, roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(client);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
    client.currentRoom = null;
    console.log(`Client ${client.id} left room: ${roomId}`);
  }

  private broadcastToRoom(roomId: string, data: any, fromClient: WsClient) {
    const logger = clientLogger(fromClient);
    const room  = this.rooms.get(roomId);
    if (!room) {
      console.log('====== rooms:', JSON.stringify(Array.from(this.rooms.keys())));
      logger.log(`Cannot broadcast to room ${roomId}: room does not exist`);
      return;
    }

    logger.log(`Broadcasting message to room ${roomId} with ${room.size} clients:`, data);
    const dataStr = JSON.stringify(data);
    room.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(dataStr);
        } catch (error) {
          logger.error(`Failed to send to "${client.user}" in room ${roomId}:`, error);
        }
      } 
    });
    logger.log(`Broadcast complete for room ${roomId}`);
    console.log('-'.repeat(80));
  }

  private broadcastToAllClients(message: any) {
    console.log(`Broadcasting to all clients (${this.clientStore.size} total):`, message);
    this.clientStore.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('Failed to send broadcast message to client:', error);
        }
      }
    });
  }
}

function validateMessage(message: any): WsMessage {
  if (!message || typeof message !== 'object') {
    throw new Error('Invalid message format');
  }
  if (!message.domain || !message.payload || !message.payload.type || !message.payload.data) {
     console.error('---- DEBUG ----');
     console.error('Invalid message structure:', JSON.stringify(message, null, 2));
    throw new Error('Message must have domain, payload with type and data');
  }
  return message as WsMessage;
}

export { WebSocketManager};

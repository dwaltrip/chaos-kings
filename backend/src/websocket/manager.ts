import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { WsClientId, WsActions } from './types';

type RoomId = string;

interface WsClient {
  id: WsClientId
  ws: WebSocket;
  currentRoom: RoomId | null;
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

function clientLogger(clientId: string) {
  const prefix = `[${clientId}]`;
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
    private handleMessage: (payload: any) => void,
  ) {
    this.wss = new WebSocketServer({ port });
    console.log(`WebSocket server running on ws://localhost:${port}`);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.wss.on('connection', async (ws: WebSocket) => {
      const client = this.clientStore.addClient(ws);
      const logger = clientLogger(client.id);
      logger.log('New client connected');
      
      ws.on('message', (buffer: Buffer) => {
        const bufferStr = buffer.toString();
        try {
          const data = JSON.parse(bufferStr);
          logger.log('[message] raw:', bufferStr, '-- parsed:', data);
          /* -----------------------------------------------------
            TODO: Implement message handling / routing logic here
            HANDLE_MESSAGE(client, message, this);
          ----------------------------------------------------- */
          this.handleMessage(client, data, this.actionsForClient(client));
        } catch (error) {
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
    console.log(`Client ${client.id} joined room: ${roomId}`);
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

  private broadcastToRoom(roomId: string, message: any, fromClient: WsClient) {
    const logger = clientLogger(fromClient.id);
    const room  = this.rooms.get(roomId);
    if (!room) {
      logger.log(`Cannot broadcast to room ${roomId}: room does not exist`);
      return;
    }
    
    logger.log(`Broadcasting message to room ${roomId} with ${room.size} clients:`, message);
    room.forEach((clientId) => {
      const client = this.clientStore.getById(clientId);
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          const messageStr = JSON.stringify(message);
          client.ws.send(messageStr);
          logger.log(`Message sent to client in room ${roomId}`);
        } catch (error) {
          logger.error(`Failed to send message to client in room ${roomId}:`, error);
        }
      } 
    });
    logger.log(`Broadcast complete for room ${roomId}`);
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

export { WebSocketManager};

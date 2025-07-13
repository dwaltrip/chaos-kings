import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

type WsClientId = string;

interface WsClient {
  id: WsClientId
  ws: WebSocket;
}

function createWsClient(ws: WebSocket): WsClient {
  const id = `client-${uuidv4()}`;
  return { id, ws };
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
  private rooms = new Map<string, Set<WsClientId>>();
  clientStore = new ClientStore();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    console.log(`WebSocket server running on ws://localhost:${port}`);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.wss.on('connection', async (ws: WebSocket) => {
      const client = this.clientStore.addClient(ws);
      const logger = clientLogger(client.id);
      logger.log('New client connected');
      
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          logger.log('[message] raw:', data.toString(), '-- parsed:', message);
          /* -----------------------------------------------------
            TODO: Implement message handling / routing logic here
            HANDLE_MESSAGE(client, message, this);
          ----------------------------------------------------- */
        } catch (error) {
          logger.error('Error parsing message:', error, '-- data:', data.toString());
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

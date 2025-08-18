import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { FastifyRequest } from 'fastify';
import type { WebSocket as FastifyWebSocket } from '@fastify/websocket';

import { invariant } from '@common/utils/invariant';
import { User } from '@common/types/user';
import {
  WsClientId,
  WsActions,
  WsMessageHandler,
  WsMessage,
} from '@/websocket/types';
import { handleWebSocketMessage } from '@/websocket/api';

type RoomId = string;

interface WsClient {
  id: WsClientId;
  ws: WebSocket;
  rooms: Set<RoomId>;
  user?: User;
}

function createWsClient(ws: WebSocket): WsClient {
  const id = `client-${uuidv4()}`;
  return { id, ws, rooms: new Set() };
}

class ClientStore {
  private clients = new Map<WebSocket, WsClient>();

  addClient(ws: WebSocket): WsClient {
    const client = createWsClient(ws);
    this.clients.set(ws, client);
    return client;
  }

  removeClient(client: WsClient) {
    this.clients.delete(client.ws);
  }

  getBySocket(ws: WebSocket): WsClient {
    const client = this.clients.get(ws);
    if (!client) {
      throw new Error(`Client with given WebSocket not found`);
    }
    return client;
  }

  forEach(callback: (client: WsClient) => void) {
    this.clients.forEach(callback);
  }

  get size(): number {
    return this.clients.size;
  }
}

function clientLogger(client: WsClient) {
  const userStr = client.user ? `${client.user.username}` : 'anonymous';
  const prefix = `[manage:${userStr}-${client.id.slice(0, 5)}..]`;
  return {
    log: (...args: any[]) => console.log(prefix, ...args),
    error: (...args: any[]) => console.error(prefix, ...args),
  };
}

class WebSocketManager {
  private rooms = new Map<string, Set<WsClient>>();
  clientStore = new ClientStore();

  constructor() {
    console.log('WebSocket manager initialized for Fastify integration');
    console.log('='.repeat(80));
    console.log();
  }

  handleConnection(connection: FastifyWebSocket, req: FastifyRequest) {
    const ws = connection;
    const client = this.clientStore.addClient(ws);

    invariant(!!req.currentUser, 'Request must have currentUser set');
    // Link WebSocket to authenticated user from request
    client.user = req.currentUser;

    const logger = clientLogger(client);
    console.log('-'.repeat(80));
    logger.log('New client connected');

    ws.on('message', (buffer: Buffer) => {
      const bufferStr = buffer.toString();
      try {
        const data: WsMessage = validateMessage(JSON.parse(bufferStr));
        data.user = client.user; // Attach user info to message
        handleWebSocketMessage(data, this.actionsForClient(client));
      } catch (error) {
        logger.error('Error parsing message:', error, '-- data:', bufferStr);
      }
    });

    ws.on('close', async () => {
      logger.log('Client disconnected');
      // Remove client from all rooms before removing from store
      client.rooms.forEach((roomId) => {
        this.leaveRoom(client, roomId);
      });
      this.clientStore.removeClient(client);
      logger.log('Client cleanup completed');
    });

    ws.on('error', (error: Error) => {
      logger.error('WebSocket error:', error);
    });
  }

  private actionsForClient(client: WsClient): WsActions {
    return {
      joinRoom: (roomId: string) => this.joinRoom(client, roomId),
      leaveRoom: (roomId: string) => this.leaveRoom(client, roomId),
      broadcastToRoom: (roomId: string, data: WsMessage) => {
        this.broadcastToRoom(roomId, data, client);
      },
      sendToSelf: (data: WsMessage) => client.ws.send(JSON.stringify(data)),
    };
  }

  private joinRoom(client: WsClient, roomId: string) {
    // Don't auto-leave other rooms - allow multiple room memberships
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(client);
    client.rooms.add(roomId);
    clientLogger(client).log(`Joined room: ${roomId}`);
  }

  private leaveRoom(client: WsClient, roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(client);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
    client.rooms.delete(roomId);
    clientLogger(client).log(`Left room: ${roomId}`);
  }

  private broadcastToRoom(
    roomId: string,
    data: WsMessage,
    fromClient: WsClient,
  ) {
    const logger = clientLogger(fromClient);
    const room = this.rooms.get(roomId);
    if (!room) {
      console.log(
        '====== rooms:',
        JSON.stringify(Array.from(this.rooms.keys())),
      );
      logger.log(`Cannot broadcast to room ${roomId}: room does not exist`);
      return;
    }

    logger.log(`Broadcasting to room ${roomId} with ${room.size} clients`);
    const dataStr = JSON.stringify(data);
    room.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(dataStr);
        } catch (error) {
          const userStr = client.user
            ? `${client.user.username || client.user.id}`
            : 'anonymous';
          logger.error(
            `Failed to send to "${userStr}" in room ${roomId}:`,
            error,
          );
        }
      }
    });
    console.log('-'.repeat(80));
  }

  public serverBroadcastToRoom(roomId: string, data: WsMessage) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.log(
        `[WebSocketManager] Cannot broadcast to room ${roomId}: room does not exist`,
      );
      console.log(
        `[WebSocketManager] Available rooms:`,
        Array.from(this.rooms.keys()),
      );
      return;
    }

    const dataStr = JSON.stringify(data);
    room.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(dataStr);
        } catch (error) {
          const userStr = client.user
            ? `${client.user.username || client.user.id}`
            : 'anonymous';
          console.error(
            `[WebSocketManager] Failed to send to "${userStr}" in room ${roomId}:`,
            error,
          );
        }
      }
    });
  }

  public removeUserFromRoom(userId: string, roomId: string): void {
    this.clientStore.forEach((client) => {
      if (
        client.user &&
        client.user.id.toString() === userId &&
        client.rooms.has(roomId)
      ) {
        this.leaveRoom(client, roomId);
        console.log(
          `[WebSocketManager] Removed user ${userId} from room ${roomId}`,
        );
      }
    });
  }
}

function validateMessage(data: unknown): WsMessage {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data format');
  }
  const obj = data as Record<string, unknown>;
  if (!obj.domain || !obj.type || !obj.payload) {
    console.error('Invalid message structure:', JSON.stringify(data, null, 2));
    // throw new Error('Message must have domain, payload with type and data');
  }
  return data as WsMessage;
}

export { WebSocketManager };

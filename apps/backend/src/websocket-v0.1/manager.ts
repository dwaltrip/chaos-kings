import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { FastifyRequest } from 'fastify';
import type { WebSocket as FastifyWebSocket } from '@fastify/websocket';

import { invariant } from '@common/utils/invariant';
import { User } from '@common/types/user';
import { WsClientId, ClientWsActions } from '@/websocket/types';
import type { WsServerInbound } from '@common/types/websockets';
import { createScopedLogger, ScopedLogger } from '@/utils/scoped-logger';
import { WsClientEnvelope, WsServerOutbound } from '@common/types/websockets';

type RoomId = string;

interface WsClient {
  id: WsClientId;
  ws: WebSocket;
  rooms: Set<RoomId>;
  user?: User;
  log: ScopedLogger;
}

const moduleLogger = createScopedLogger('WsManager');

function createWsClient(ws: WebSocket): WsClient {
  const id = `client-${uuidv4()}`;
  const log = createScopedLogger(() => `WsManager ws=${id.slice(0, 13)}...`);
  return { id, ws, rooms: new Set(), log };
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

class WebSocketManager {
  private rooms = new Map<string, Set<WsClient>>();
  clientStore = new ClientStore();
  log = moduleLogger;
  private dispatchFn: (data: WsServerInbound, actions: ClientWsActions) => void;

  constructor(dispatchFn: (data: WsServerInbound, actions: ClientWsActions) => void) {
    this.dispatchFn = dispatchFn;
    this.log.info('WebSocket manager initialized for Fastify integration');
    this.log.info('='.repeat(80));
  }

  handleConnection(connection: FastifyWebSocket, req: FastifyRequest) {
    const ws = connection;
    const client = this.clientStore.addClient(ws);

    invariant(!!req.currentUser, 'Request must have currentUser set');
    // Link WebSocket to authenticated user from request
    client.user = req.currentUser;

    client.log.info('-'.repeat(80));
    client.log.info('New client connected');

    ws.on('message', (buffer: Buffer) => {
      const bufferStr = buffer.toString();
      if (!client.user) {
        client.log.error(
          'Received message but no user is associated with this client -- ignoring message',
        );
        return;
      }
      try {
        const data: WsServerInbound = {
          ...validateClientEnvelope(JSON.parse(bufferStr)),
          user: client.user, // Attach user info to message
        };
        this.dispatchFn(data, this.actionsForClient(client));
      } catch (error) {
        client.log.error('Error parsing message:', error, '-- data:', bufferStr);
      }
    });

    ws.on('close', async () => {
      client.log.info('Client disconnected');
      // Remove client from all rooms before removing from store
      client.rooms.forEach((roomId) => {
        this.leaveRoom(client, roomId);
      });
      this.clientStore.removeClient(client);
      client.log.info('Client cleanup completed');
    });

    ws.on('error', (error: Error) => {
      client.log.error('WebSocket error:', error);
    });
  }

  private actionsForClient(client: WsClient): ClientWsActions {
    return {
      join: (roomId: string) => this.joinRoom(client, roomId),
      leave: (roomId: string) => this.leaveRoom(client, roomId),
      broadcast: (roomId: string, data: WsServerOutbound) => {
        this.broadcastToRoom(roomId, data, client);
      },
      reply: (data: WsServerOutbound) => client.ws.send(JSON.stringify(data)),
    };
  }

  private joinRoom(client: WsClient, roomId: string) {
    // Don't auto-leave other rooms - allow multiple room memberships
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(client);
    client.rooms.add(roomId);
    client.log.info(`Joined room: ${roomId}`);
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
    client.log.info(`Left room: ${roomId}`);
  }

  // TODO: make it more clear the difference between this and serverBroadcastToRoom?
  // Better naming?
  // `serverBroadcastToRoom` is for broadcasts that have no direct connection to an
  // incoming client message.
  // Whereas `broadcastToRoom` occurs while handling an incoming client message.
  private broadcastToRoom(roomId: string, data: WsServerOutbound, fromClient: WsClient) {
    const room = this.rooms.get(roomId);
    if (!room) {
      fromClient.log.info(`Cannot broadcast to room ${roomId} - room does not exist`);
      fromClient.log.info(
        '====== Available rooms:',
        JSON.stringify(Array.from(this.rooms.keys())),
      );
      return;
    }

    fromClient.log.info(`Broadcasting to room ${roomId} with ${room.size} clients`);
    const dataStr = JSON.stringify(data);
    room.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(dataStr);
        } catch (error) {
          client.log.error(
            `Failed to send msg (type: ${data.type}) in room ${roomId}. Error:`,
            error,
          );
        }
      }
    });
    fromClient.log.info('-'.repeat(80));
  }

  public serverBroadcastToRoom(roomId: string, data: WsServerOutbound) {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.log.info(`Cannot broadcast to room ${roomId}: it does not exist.`);
      this.log.info(`Available rooms:`, Array.from(this.rooms.keys()));
      return;
    }

    const dataStr = JSON.stringify(data);
    room.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(dataStr);
        } catch (error) {
          client.log.error(`Failed to send msg for room ${roomId}:`, error);
        }
      }
    });
  }

  public sendToUser(userId: string, data: WsServerOutbound): void {
    const dataStr = JSON.stringify(data);
    this.clientStore.forEach((client) => {
      if (
        client.user &&
        client.user.id.toString() === userId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        try {
          client.ws.send(dataStr);
        } catch (error) {
          client.log.error(
            `Failed to send direct msg (type: ${data.type}) to user ${userId}:`,
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
        client.log.info(`Removed user (id=${userId}) from room ${roomId}`);
      }
    });
  }
}

function validateClientEnvelope(data: unknown): WsClientEnvelope {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data format');
  }
  const obj = data as Record<string, unknown>;
  // Payload can be null, some messages do not require data
  // But it should be explicitly set to null if no payload
  if (!obj.domain || !obj.type || !('payload' in obj)) {
    moduleLogger.error('----------------------------------');
    moduleLogger.error('Invalid message structure -- data:');
    moduleLogger.error(JSON.stringify(data, null, 2));
    moduleLogger.error('----------------------------------');
  }
  return data as WsClientEnvelope;
}

export { WebSocketManager };

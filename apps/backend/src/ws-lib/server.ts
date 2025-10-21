import type { WebSocket, RawData } from 'ws';

import type { HandlerMapWithCtx, ConnectionId, BroadcastOptions } from './types';
import { RoomManager } from './room-manager';

// TODO: Replace with uuid / or something else better
function generateConnectionId(): ConnectionId {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// WsClient internal representation
type WsClient = {
  id: ConnectionId;
  userKey: string;
  ws: WebSocket;
  // TODO: Add scoped logger if needed
};

// Server config
type WSServerConfig<
  TIncoming extends { type: string; payload: unknown },
  TOutgoing,
  TContext,
  TConnectionContext,
> = {
  handlers: HandlerMapWithCtx<TIncoming, TContext>;
  createContext: (
    connectionContext: TConnectionContext,
    connectionId: ConnectionId,
  ) => TContext;
  getUserKey: (connectionContext: TConnectionContext) => string; // used for sendToUser()
  onDisconnect?: (context: TContext) => void;
  encode?: (msg: TOutgoing) => string;
  decode?: (raw: string) => TIncoming;
};

// Server instance (what bootstrap uses)
type WSServerInstance<TOutgoing, TConnectionContext> = {
  handleConnection(ws: WebSocket, connectionContext: TConnectionContext): void;
  broadcast(message: TOutgoing, opts?: BroadcastOptions): void;
  broadcastToRoom(roomId: string, message: TOutgoing, opts?: BroadcastOptions): void;
  sendToUser(userKey: string, message: TOutgoing): void;
  rooms: RoomManager;
};

function createWSServer<
  TIncoming extends { type: string; payload: unknown },
  TOutgoing,
  TContext,
  TConnectionContext,
>(
  config: WSServerConfig<TIncoming, TOutgoing, TContext, TConnectionContext>,
): WSServerInstance<TOutgoing, TConnectionContext> {
  const { handlers, createContext, getUserKey, onDisconnect, encode, decode } = config;

  const clients = new Map<ConnectionId, WsClient>();
  const roomManager = new RoomManager();

  // Default encode/decode
  const encodeMsg = encode || ((msg: TOutgoing) => JSON.stringify(msg));
  const decodeMsg = decode || ((raw: string) => JSON.parse(raw) as TIncoming);

  function handleConnection(ws: WebSocket, connectionContext: TConnectionContext) {
    const connectionId = generateConnectionId();

    // Create and store client
    const client: WsClient = {
      id: connectionId,
      userKey: getUserKey(connectionContext),
      ws,
    };
    clients.set(connectionId, client);

    // Create context with the generated connectionId
    const context = createContext(connectionContext, connectionId);

    console.log(`[WS] Client connected: ${connectionId}`);

    // Handle incoming messages
    ws.on('message', async (raw: RawData) => {
      try {
        // Fastify passes Buffer | ArrayBuffer | Buffer[] | string. Normalize before decoding.
        // TODO: Are these checks / normalizations a fine way to do this?
        const rawString =
          typeof raw === 'string'
            ? raw
            : Array.isArray(raw)
              ? Buffer.concat(raw).toString('utf8')
              : Buffer.isBuffer(raw)
                ? raw.toString('utf8')
                : Buffer.from(raw).toString('utf8');
        const message = decodeMsg(rawString);
        const handler = handlers[message.type as keyof typeof handlers];

        if (!handler) {
          console.warn(`[WS] No handler for message type: ${message.type}`);
          return;
        }

        await handler(message.payload as any, context);
      } catch (error) {
        console.error('[WS] Error handling message:', error);
        // TODO: Send error message back to client?
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${connectionId}`);
      roomManager.removeAllRooms(connectionId);
      clients.delete(connectionId);
      onDisconnect?.(context);
    });

    ws.on('error', (error: Error) => {
      console.error(`[WS] WebSocket error for ${connectionId}:`, error);
      roomManager.removeAllRooms(connectionId);
      clients.delete(connectionId);
    });
  }

  function broadcast(message: TOutgoing, opts?: BroadcastOptions) {
    const encoded = encodeMsg(message);
    for (const [id, client] of clients) {
      if (opts?.excludeConnectionId && id === opts.excludeConnectionId) {
        continue;
      }
      if (client.ws.readyState === 1 /* WebSocket.OPEN */) {
        client.ws.send(encoded);
      }
    }
  }

  function broadcastToRoom(roomId: string, message: TOutgoing, opts?: BroadcastOptions) {
    const members = roomManager.getMembers(roomId);
    const encoded = encodeMsg(message);

    for (const connectionId of members) {
      if (opts?.excludeConnectionId && connectionId === opts.excludeConnectionId) {
        continue;
      }
      const client = clients.get(connectionId);
      if (client && client.ws.readyState === 1 /* WebSocket.OPEN */) {
        client.ws.send(encoded);
      }
    }
  }

  function sendToUser(userKey: string, message: TOutgoing) {
    const encoded = encodeMsg(message);
    // Find all connections for this user
    for (const client of clients.values()) {
      if (client.userKey === userKey && client.ws.readyState === 1 /* WebSocket.OPEN */) {
        client.ws.send(encoded);
      }
    }
  }

  return {
    handleConnection,
    broadcast,
    broadcastToRoom,
    sendToUser,
    rooms: roomManager,
  };
}

export type { WSServerConfig, WSServerInstance };
export { createWSServer };

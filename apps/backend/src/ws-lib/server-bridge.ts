import type { WsBridge, BroadcastOptions, ConnectionId } from './types';
import type { WSServerInstance } from './server';

class ServerBridge<TMessage, TConnectionContext> implements WsBridge<TMessage> {
  private transport: WSServerInstance<TMessage, TConnectionContext> | null = null;

  init(transport: WSServerInstance<TMessage, TConnectionContext>) {
    if (this.transport) {
      throw new Error('ServerBridge already initialized');
    }
    this.transport = transport;
  }

  private getTransport() {
    if (!this.transport) {
      throw new Error('ServerBridge not initialized. Call init() first.');
    }
    return this.transport;
  }

  broadcast(message: TMessage, opts?: BroadcastOptions): void {
    this.getTransport().broadcast(message, opts);
  }

  broadcastToRoom(roomId: string, message: TMessage, opts?: BroadcastOptions): void {
    this.getTransport().broadcastToRoom(roomId, message, opts);
  }

  sendToUser(userKey: string, message: TMessage): void {
    this.getTransport().sendToUser(userKey, message);
  }

  getConnectionsForUser(userKey: string, filterByRoom?: string): Set<ConnectionId> {
    return this.getTransport().getConnectionsForUser(userKey, filterByRoom);
  }

  get rooms() {
    return {
      join: (roomId: string, connectionId: ConnectionId) => {
        this.getTransport().rooms.join(connectionId, roomId);
      },
      leave: (roomId: string, connectionId: ConnectionId) => {
        this.getTransport().rooms.leave(connectionId, roomId);
      },
      getMembers: (roomId: string): Set<ConnectionId> => {
        return this.getTransport().rooms.getMembers(roomId);
      },
    };
  }
}

export { ServerBridge };

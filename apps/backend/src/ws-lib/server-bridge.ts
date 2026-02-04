import type { WsBridge, BroadcastOptions, ConnectionId } from './types';
import type { WSServerInstance } from './server';

type DisconnectHandler<TContext> = (context: TContext) => void;

class ServerBridge<TMessage, TConnectionContext, TContext = unknown>
  implements WsBridge<TMessage>
{
  private transport: WSServerInstance<TMessage, TConnectionContext> | null = null;
  private disconnectHandlers: DisconnectHandler<TContext>[] = [];

  init(transport: WSServerInstance<TMessage, TConnectionContext>) {
    if (this.transport) {
      throw new Error('ServerBridge already initialized');
    }
    this.transport = transport;
  }

  onDisconnect(handler: DisconnectHandler<TContext>): void {
    this.disconnectHandlers.push(handler);
  }

  runDisconnectHandlers(context: TContext): void {
    for (const handler of this.disconnectHandlers) {
      handler(context);
    }
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

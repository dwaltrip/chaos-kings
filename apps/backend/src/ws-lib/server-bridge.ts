import type { ServerMessage } from './types';
import type { WsBridge, BroadcastOptions, ConnectionId } from './types';
import type { WSServerInstance } from './server';

class ServerBridge implements WsBridge {
  private transport: WSServerInstance<ServerMessage> | null = null;

  init(transport: WSServerInstance<ServerMessage>) {
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

  broadcast(message: ServerMessage, opts?: BroadcastOptions): void {
    this.getTransport().broadcast(message, opts);
  }

  broadcastToRoom(roomId: string, message: ServerMessage, opts?: BroadcastOptions): void {
    this.getTransport().broadcastToRoom(roomId, message, opts);
  }

  sendToUser(userKey: string, message: ServerMessage): void {
    this.getTransport().sendToUser(userKey, message);
  }

  get rooms() {
    return {
      join: (roomId: string, connectionId: ConnectionId) => {
        this.getTransport().rooms.join(connectionId, roomId);
      },
      leave: (roomId: string, connectionId: ConnectionId) => {
        this.getTransport().rooms.leave(connectionId, roomId);
      },
      getMembers: (roomId: string) => {
        return this.getTransport().rooms.getMembers(roomId);
      },
    };
  }
}

// Export singleton instance
const wsBridge = new ServerBridge();

export { wsBridge };

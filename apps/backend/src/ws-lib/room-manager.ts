import type { ConnectionId } from './types';

// TODO: can we not use raw string for room IDs here?
//  In the app code, room ID is branded.

class RoomManager {
  // Which connections are in which rooms
  private rooms = new Map<string, Set<ConnectionId>>();

  // Inverse index: which rooms each connection is in (for cleanup)
  private roomsForConnection = new Map<ConnectionId, Set<string>>();

  join(connectionId: ConnectionId, roomId: string): void {
    // Add to room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(connectionId);

    // Update inverse index
    if (!this.roomsForConnection.has(connectionId)) {
      this.roomsForConnection.set(connectionId, new Set());
    }
    this.roomsForConnection.get(connectionId)!.add(roomId);
  }

  leave(connectionId: ConnectionId, roomId: string): void {
    // Remove from room
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(connectionId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    // Update inverse index
    const userRooms = this.roomsForConnection.get(connectionId);
    if (userRooms) {
      userRooms.delete(roomId);
      if (userRooms.size === 0) {
        this.roomsForConnection.delete(connectionId);
      }
    }
  }

  getMembers(roomId: string): Set<ConnectionId> {
    return this.rooms.get(roomId) || new Set();
  }

  getRoomsForConnection(connectionId: ConnectionId): Set<string> {
    return this.roomsForConnection.get(connectionId) || new Set();
  }

  // Cleanup on disconnect - remove connection from all rooms
  removeAllRooms(connectionId: ConnectionId): void {
    const userRooms = this.roomsForConnection.get(connectionId);
    if (userRooms) {
      for (const roomId of userRooms) {
        this.leave(connectionId, roomId);
      }
    }
  }
}

export { RoomManager };

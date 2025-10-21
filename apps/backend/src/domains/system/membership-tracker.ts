import { idToString } from '@kernel/branded-type';
import { RoomId, UserId } from '@kernel/ids';

import type { ConnectionId } from '@/ws-lib/types';

type MembershipRecord = {
  connectionId: ConnectionId;
  userId: UserId;
};

class RoomMembershipTracker {
  private memberships = new Map<string, Map<ConnectionId, UserId>>();

  add(roomId: RoomId, record: MembershipRecord): void {
    const roomKey = idToString(roomId);
    if (!this.memberships.has(roomKey)) {
      this.memberships.set(roomKey, new Map());
    }
    this.memberships.get(roomKey)!.set(record.connectionId, record.userId);
  }

  remove(roomId: RoomId, connectionId: ConnectionId): void {
    const roomKey = idToString(roomId);
    const members = this.memberships.get(roomKey);
    if (!members) {
      return;
    }

    members.delete(connectionId);

    if (members.size === 0) {
      this.memberships.delete(roomKey);
    }
  }

  has(roomId: RoomId, connectionId: ConnectionId): boolean {
    const roomKey = idToString(roomId);
    return this.memberships.get(roomKey)?.has(connectionId) ?? false;
  }

  getUserIds(roomId: RoomId): UserId[] {
    const roomKey = idToString(roomId);
    const members = this.memberships.get(roomKey);
    if (!members) {
      return [];
    }

    return Array.from(new Set(members.values()));
  }

  removeConnectionFromAll(connectionId: ConnectionId): RoomId[] {
    const affectedRooms: RoomId[] = [];

    for (const [roomKey, members] of this.memberships.entries()) {
      members.delete(connectionId);
      if (members.size === 0) {
        this.memberships.delete(roomKey);
        affectedRooms.push(RoomId(roomKey));
      } else if (affectedRooms.every((roomId) => idToString(roomId) !== roomKey)) {
        affectedRooms.push(RoomId(roomKey));
      }
    }

    return affectedRooms;
  }
}

const roomMembershipTracker = new RoomMembershipTracker();

export { roomMembershipTracker };

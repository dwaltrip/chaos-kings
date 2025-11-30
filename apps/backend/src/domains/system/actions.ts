import { idToString } from '@kernel/branded-type';
import { RoomId, UserId } from '@kernel/ids';
import { makeRoomId } from '@protocol/domains/system';

import type { ConnectionContext } from '@/ws/connection-context';
import type { ConnectionId } from '@/ws-lib/types';
import { wsBridge } from '@/ws/server-bridge-bootstrap';
import { roomMembershipTracker } from '@/domains/system/membership-tracker';
import { systemWsEffects } from '@/domains/system/ws-effects';

type JoinRoomParams = {
  roomId: RoomId;
  userId: UserId;
  connectionId: ConnectionId;
};

type LeaveRoomParams = JoinRoomParams;

const systemActions = {
  joinRoom({ roomId, userId, connectionId }: JoinRoomParams) {
    if (!roomMembershipTracker.has(roomId, connectionId)) {
      wsBridge.rooms.join(idToString(roomId), connectionId);
      roomMembershipTracker.add(roomId, { userId, connectionId });
    }

    const memberIds = roomMembershipTracker.getUserIds(roomId);
    systemWsEffects.broadcastRoomStatus({ roomId, memberIds });
  },

  leaveRoom({ roomId, userId: _userId, connectionId }: LeaveRoomParams) {
    wsBridge.rooms.leave(idToString(roomId), connectionId);
    roomMembershipTracker.remove(roomId, connectionId);

    const memberIds = roomMembershipTracker.getUserIds(roomId);
    systemWsEffects.broadcastRoomStatus({ roomId, memberIds });
  },

  ensureJoined(domain: string, slug: string, ctx: ConnectionContext) {
    const roomId = makeRoomId(domain, slug);

    systemActions.joinRoom({
      roomId,
      userId: UserId(ctx.userId),
      connectionId: ctx.connectionId,
    });

    return roomId;
  },
};

export { systemActions };

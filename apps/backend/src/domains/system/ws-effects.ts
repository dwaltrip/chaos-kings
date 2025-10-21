import { idToNumber, idToString } from '@kernel/branded-type';
import { UserId } from '@kernel/ids';
import { SystemServerMsgCreators } from '@protocol/domains/system';
import type { RoomStatusPayload } from '@protocol/domains/system';

import { wsBridge } from '@/ws/server-bridge-bootstrap';

const systemWsEffects = {
  broadcastRoomStatus(payload: RoomStatusPayload) {
    wsBridge.broadcastToRoom(
      idToString(payload.roomId),
      SystemServerMsgCreators.createRoomStatusUpdateMessage(payload),
    );
  },

  sendRoomStatusToUser(userId: UserId, payload: RoomStatusPayload) {
    wsBridge.sendToUser(
      String(idToNumber(userId)),
      SystemServerMsgCreators.createRoomStatusUpdateMessage(payload),
    );
  },
};

export { systemWsEffects };

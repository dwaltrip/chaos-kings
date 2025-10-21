import { RoomId } from '@kernel/ids';
import { makeRoomId, SystemClientMsgCreators } from '@protocol/domains/system';

// TODO: [PHASE-2] Import wsBridge when available
// import { wsBridge } from '@/ws/bridge';
const wsBridge: any = {};

const systemWsEffects = {
  joinRoom(roomId: RoomId) {
    wsBridge.send?.(SystemClientMsgCreators.createJoinRoomMessage(roomId));
  },

  leaveRoom(roomId: RoomId) {
    wsBridge.send?.(SystemClientMsgCreators.createLeaveRoomMessage(roomId));
  },

  makeRoomId(domain: string, slug: string) {
    return makeRoomId(domain, slug);
  },
};

export { systemWsEffects };

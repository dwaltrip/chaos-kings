import { idToString } from '@kernel/branded-type';
import { RoomId } from '@kernel/domains/system';

// TODO: [PHASE-2] Import wsBridge when available
// import { wsBridge } from '@/ws/bridge';
const wsBridge: any = {};

// TODO: [SYSTEM_DOMAIN] Define system protocol messages
// import { MsgCreators } from '@protocol/domains/system/client-messages';
const MsgCreators: any = {};

const systemWsEffects = {
  joinRoom(roomId: RoomId) {
    // TODO: [SYSTEM_DOMAIN] Implement when protocol is defined
    // wsBridge.send(MsgCreators.createJoinRoomMessage(idToString(roomId)));
  },

  leaveRoom(roomId: RoomId) {
    // TODO: [SYSTEM_DOMAIN] Implement when protocol is defined
    // wsBridge.send(MsgCreators.createLeaveRoomMessage(idToString(roomId)));
  },
};

export { systemWsEffects };

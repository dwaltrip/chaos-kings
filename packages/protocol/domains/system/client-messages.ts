import type { RoomId } from '@kernel/ids';
import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { ExtractMsg } from '@protocol/utils/type-helpers';

type SystemClientPayloadMap = {
  'system:join-room': {
    roomId: RoomId;
  };
  'system:leave-room': {
    roomId: RoomId;
  };
};

type SystemClientMessage = MessageUnion<SystemClientPayloadMap>;
type SystemJoinRoomMessage = ExtractMsg<SystemClientMessage, 'system:join-room'>;
type SystemLeaveRoomMessage = ExtractMsg<SystemClientMessage, 'system:leave-room'>;

const MsgCreators = {
  createJoinRoomMessage: (roomId: RoomId): SystemJoinRoomMessage => ({
    type: 'system:join-room',
    payload: { roomId },
  }),
  createLeaveRoomMessage: (roomId: RoomId): SystemLeaveRoomMessage => ({
    type: 'system:leave-room',
    payload: { roomId },
  }),
} as const;

export type { SystemClientPayloadMap, SystemClientMessage };
export { MsgCreators };

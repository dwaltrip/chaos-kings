import { RoomId, UserId } from '@kernel/ids';
import { MessageUnion } from '@protocol/utils/message-helpers';
import { ExtractMsg } from '@protocol/utils/type-helpers';

type RoomStatusPayload = {
  roomId: RoomId;
  memberIds: UserId[];
};

type SystemServerPayloadMap = {
  'system:room-status-update': RoomStatusPayload;
};

type SystemServerMessage = MessageUnion<SystemServerPayloadMap>;
type SystemRoomStatusUpdateMessage = ExtractMsg<
  SystemServerMessage,
  'system:room-status-update'
>;

const MsgCreators = {
  createRoomStatusUpdateMessage: (
    payload: RoomStatusPayload,
  ): SystemRoomStatusUpdateMessage => ({
    type: 'system:room-status-update',
    payload,
  }),
} as const;

export type { RoomStatusPayload, SystemServerPayloadMap, SystemServerMessage };
export { MsgCreators };

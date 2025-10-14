import { MessageUnion } from '@protocol/utils/message-helpers';
import { ExtractMsg } from '@protocol/utils/type-helpers';

type ChatServerPayloadMap = {
  // NOTE: used to be "game-chat:new-message"
  // TODO: update rest of the app to match new name
  'chat:broadcast-message': {
    roomId: string; // TODO: [BRANDED_TYPES-roomId]
    content: string;
    userId: string; // TODO: [BRANDED_TYPES-userId]
    timestamp: number;
  };
};

type ChatServerMessage = MessageUnion<ChatServerPayloadMap>;
type BroadcastMessageMessage = ExtractMsg<ChatServerMessage, 'chat:broadcast-message'>;

const MsgCreators = {
  createBroadcastMessageMessage: (
    roomId: string, // TODO: [BRANDED_TYPES-roomId]
    content: string,
    userId: string, // TODO: [BRANDED_TYPES-userId]
    timestamp: number,
  ): BroadcastMessageMessage => ({
    type: 'chat:broadcast-message',
    payload: { roomId, content, userId, timestamp },
  }),
} as const;

export type { ChatServerPayloadMap, ChatServerMessage };
export { MsgCreators };

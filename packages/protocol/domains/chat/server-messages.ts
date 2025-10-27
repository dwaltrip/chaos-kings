import { MessageUnion } from '@protocol/utils/message-helpers';
import { ExtractMsg } from '@protocol/utils/type-helpers';

type ChatServerPayloadMap = {
  // NOTE: used to be "game-chat:new-message"
  // TODO: update rest of the app to match new name
  'chat:broadcast-message': {
    roomId: string;
    content: string;
    userId: number;
    username: string;
    timestamp: number;
  };
};

type ChatServerMessage = MessageUnion<ChatServerPayloadMap>;
type BroadcastMessageMessage = ExtractMsg<ChatServerMessage, 'chat:broadcast-message'>;

const MsgCreators = {
  createBroadcastMessageMessage: (
    roomId: string,
    content: string,
    userId: number,
    username: string,
    timestamp: number,
  ): BroadcastMessageMessage => ({
    type: 'chat:broadcast-message',
    payload: { roomId, content, userId, username, timestamp },
  }),
} as const;

export type { ChatServerPayloadMap, ChatServerMessage };
export { MsgCreators };

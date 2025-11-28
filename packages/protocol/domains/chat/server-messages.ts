import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { ExtractMsg } from '@protocol/utils/type-helpers';

type ChatServerPayloadMap = {
  'chat:broadcast-message': {
    id: number;
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
    id: number,
    roomId: string,
    content: string,
    userId: number,
    username: string,
    timestamp: number,
  ): BroadcastMessageMessage => ({
    type: 'chat:broadcast-message',
    payload: { id, roomId, content, userId, username, timestamp },
  }),
} as const;

export type { ChatServerPayloadMap, ChatServerMessage };
export { MsgCreators };

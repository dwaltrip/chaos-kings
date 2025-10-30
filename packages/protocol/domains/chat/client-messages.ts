import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { ExtractMsg } from '@protocol/utils/type-helpers';

type ChatClientPayloadMap = {
  // NOTE: used to be "game-chat:post-message"
  // TODO: update rest of the app to match new name
  'chat:send-message': {
    roomId: string;
    content: string;
  };
};

type ChatClientMessage = MessageUnion<ChatClientPayloadMap>;
// ChatSendMessageMessage is an unfortunate name, but consistent w/ the pattern
// TODO:
//    Maybe change the core term "Message" to something else...
//    But that *is* the canonical term... e.g. ws.on('message', () => {...})
type SendMessageMessage = ExtractMsg<ChatClientMessage, 'chat:send-message'>;

const MsgCreators = {
  createSendMessageMessage: (roomId: string, content: string): SendMessageMessage => ({
    type: 'chat:send-message',
    payload: { roomId, content },
  }),
} as const;

export type { ChatClientPayloadMap, ChatClientMessage };
export { MsgCreators };

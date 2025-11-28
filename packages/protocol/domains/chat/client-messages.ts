import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { ExtractMsg } from '@protocol/utils/type-helpers';

type ChatClientPayloadMap = {
  'chat:send-message': {
    gameId: number;
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
  createSendMessageMessage: (gameId: number, content: string): SendMessageMessage => ({
    type: 'chat:send-message',
    payload: { gameId, content },
  }),
} as const;

export type { ChatClientPayloadMap, ChatClientMessage };
export { MsgCreators };

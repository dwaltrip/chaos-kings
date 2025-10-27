import { UserId, RoomId } from '@kernel/ids';
import type { ChatServerMessage } from '@protocol/domains/chat/server-messages';

import type { HandlerMap } from '@/ws-lib';
import { addReceivedMessage } from '@/domains/chat/actions';

import type { ChatMessage } from './types';

type ChatHandlerMap = HandlerMap<ChatServerMessage>;

const chatHandlers = {
  'chat:broadcast-message': (payload) => {
    const message: ChatMessage = {
      roomId: RoomId(payload.roomId),
      content: payload.content,
      userId: UserId(payload.userId),
      username: payload.username,
      timestamp: payload.timestamp,
    };
    addReceivedMessage(message);
  },
} as const satisfies ChatHandlerMap;

export { chatHandlers };

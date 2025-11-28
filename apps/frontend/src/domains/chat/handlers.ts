import type { ChatServerMessage } from '@protocol/domains/chat/server-messages';

import type { HandlerMap } from '@/ws-lib';
import { addReceivedMessage } from '@/domains/chat/actions';

type ChatHandlerMap = HandlerMap<ChatServerMessage>;

const chatHandlers = {
  'chat:broadcast-message': (payload) => {
    addReceivedMessage(payload);
  },
} as const satisfies ChatHandlerMap;

export { chatHandlers };

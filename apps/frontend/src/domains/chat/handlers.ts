import type { ChatServerMessage } from '@protocol/domains/chat/server-messages';

import type { HandlerMap } from '@/ws-lib';

type ChatHandlerMap = HandlerMap<ChatServerMessage>;

const chatHandlers = {
  'chat:broadcast-message': (payload) => {
    // addReceivedMessage();
  },
} as const satisfies ChatHandlerMap;

export { chatHandlers };

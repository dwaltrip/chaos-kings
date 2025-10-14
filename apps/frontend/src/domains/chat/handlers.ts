import type { HandlerMap } from '@protocol/utils/message-helpers';
import type { ChatServerMessage } from '@protocol/domains/chat/server-messages';

// import { chatActions } from './actions';

type ChatHandlerMap = HandlerMap<ChatServerMessage>;

export const chatHandlers = {
  'chat:broadcast-message': (payload) => {
    // addReceivedMessage();
  },
} as const satisfies ChatHandlerMap;

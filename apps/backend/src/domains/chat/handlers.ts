import { GameId, UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { ChatClientMessage } from '@protocol/domains/chat/client-messages';

import type { ConnectionContext } from '@/ws/connection-context';
import { createAndBroadcastChatMessage } from '@/domains/chat/actions';

const chatHandlers = {
  'chat:send-message': ({ gameId, content }, ctx) => {
    createAndBroadcastChatMessage(GameId(gameId), content, UserId(ctx.userId));
  },
} satisfies HandlerMapWithCtx<ChatClientMessage, ConnectionContext>;

export { chatHandlers };

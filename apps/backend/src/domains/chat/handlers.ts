import { UserId } from '@kernel/domains/user';
import { RoomId } from '@kernel/domains/system';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { ChatClientMessage } from '@protocol/domains/chat/client-messages';

import type { HandlerContext } from '@/ws/types';
import { broadcastChatMessage } from '@/domains/chat/actions';

const chatHandlers = {
  'chat:send-message': ({ roomId, content }, ctx) => {
    const message = {
      id: 'fake-message-id', // TODO: id should come from DB
      roomId: RoomId(roomId),
      content,
      userId: UserId(ctx.userId),
      // TODO: timestamp should come from DB
      timestamp: Date.now(),
    };
    broadcastChatMessage(message, ctx);
  },
} satisfies HandlerMapWithCtx<ChatClientMessage, HandlerContext>;

export { chatHandlers };

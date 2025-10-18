import { ChatMessageId } from '@kernel/domains/chat';
import { UserId } from '@kernel/domains/user';
import { RoomId } from '@kernel/domains/system';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { ChatClientMessage } from '@protocol/domains/chat/client-messages';

import type { HandlerContext } from '@/ws/types';
import { broadcastChatMessage } from '@/domains/chat/actions';

const chatHandlers = {
  'chat:send-message': ({ roomId, content }, ctx) => {
    // TODO: [DB] Get message ID from database after insert
    const tempId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

    const message = {
      id: ChatMessageId(tempId),
      roomId: RoomId(roomId),
      content,
      userId: UserId(ctx.userId),
      timestamp: Date.now(), // TODO: timestamp should come from DB
    };
    broadcastChatMessage(message, ctx);
  },
} satisfies HandlerMapWithCtx<ChatClientMessage, HandlerContext>;

export { chatHandlers };

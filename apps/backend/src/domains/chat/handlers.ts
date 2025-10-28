import { RoomId, UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { ChatClientMessage } from '@protocol/domains/chat/client-messages';

import type { AppHandlerContext } from '@/ws/app-handler-context';
import { broadcastChatMessage } from '@/domains/chat/actions';

const chatHandlers = {
  'chat:send-message': ({ roomId, content }, ctx) => {
    broadcastChatMessage(RoomId(roomId), content, UserId(ctx.userId));
  },
} satisfies HandlerMapWithCtx<ChatClientMessage, AppHandlerContext>;

export { chatHandlers };

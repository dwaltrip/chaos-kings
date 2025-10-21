import { RoomId, UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { SystemClientMessage } from '@protocol/domains/system/client-messages';

import type { AppHandlerContext } from '@/ws/app-handler-context';
import { systemActions } from '@/domains/system/actions';

const systemHandlers = {
  'system:join-room': ({ roomId }, ctx) => {
    systemActions.joinRoom({
      roomId: RoomId(roomId),
      userId: UserId(ctx.userId),
      connectionId: ctx.connectionId,
    });
  },

  'system:leave-room': ({ roomId }, ctx) => {
    systemActions.leaveRoom({
      roomId: RoomId(roomId),
      userId: UserId(ctx.userId),
      connectionId: ctx.connectionId,
    });
  },
} satisfies HandlerMapWithCtx<SystemClientMessage, AppHandlerContext>;

export { systemHandlers };

import { UserId } from '@kernel/ids';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { MatchmakingClientMessage } from '@protocol/domains/matchmaking/client-messages';

import type { ConnectionContext } from '@/ws/connection-context';
import { joinQueue, leaveQueue, earlyStartVote } from '@/domains/matchmaking/actions';

const matchmakingHandlers = {
  'matchmaking:join-queue': (_payload, ctx) => {
    joinQueue(UserId(ctx.userId), ctx.connectionId);
  },

  'matchmaking:leave-queue': (_payload, ctx) => {
    leaveQueue(UserId(ctx.userId), ctx.connectionId);
  },

  'matchmaking:early-start-vote': ({ vote }, ctx) => {
    earlyStartVote(vote, UserId(ctx.userId));
  },
} satisfies HandlerMapWithCtx<MatchmakingClientMessage, ConnectionContext>;

export { matchmakingHandlers };

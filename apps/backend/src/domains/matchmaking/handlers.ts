import { UserId } from '@kernel/domains/user';
import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { MatchmakingClientMessage } from '@protocol/domains/matchmaking/client-messages';

import type { AppHandlerContext } from '@/ws-handler-context';
import { matchmakingActions } from '@/domains/matchmaking/actions';

const matchmakingHandlers = {
  'matchmaking:join-queue': (payload, ctx) => {
    matchmakingActions.joinQueue(UserId(ctx.userId));
  },

  'matchmaking:leave-queue': (payload, ctx) => {
    matchmakingActions.leaveQueue(UserId(ctx.userId));
  },

  'matchmaking:early-start-vote': ({ vote }, ctx) => {
    matchmakingActions.earlyStartVote(vote, UserId(ctx.userId));
  },
} satisfies HandlerMapWithCtx<MatchmakingClientMessage, AppHandlerContext>;

export { matchmakingHandlers };

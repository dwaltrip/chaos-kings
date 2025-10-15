import type { HandlerMapWithCtx } from '@protocol/utils/message-helpers';
import type { MatchmakingClientMessage } from '@protocol/domains/matchmaking/client-messages';

import type { HandlerContext } from '@/ws/types';
import { matchmakingActions } from '@/domains/matchmaking/actions';

const matchmakingHandlers = {
  'matchmaking:join-queue': (payload, ctx) => {
    matchmakingActions.joinQueue(ctx);
  },

  'matchmaking:leave-queue': (payload, ctx) => {
    matchmakingActions.leaveQueue(ctx);
  },

  'matchmaking:early-start-vote': ({ vote }, ctx) => {
    matchmakingActions.earlyStartVote(vote, ctx);
  },
} satisfies HandlerMapWithCtx<MatchmakingClientMessage, HandlerContext>;

export { matchmakingHandlers };

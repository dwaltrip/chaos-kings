import type { HandlerMap } from '@protocol/utils/message-helpers';
import type { MatchmakingServerMessage } from '@protocol/domains/matchmaking/server-messages';

import { matchmakingActions } from '@/domains/matchmaking/actions';

type MatchmakingHandlerMap = HandlerMap<MatchmakingServerMessage>;

export const matchmakingHandlers = {
  'matchmaking:queue-status': (payload) => {
    matchmakingActions.handleQueueStatus(payload);
  },

  'matchmaking:early-start-status': (payload) => {
    matchmakingActions.handleEarlyStartStatus(payload);
  },

  'matchmaking:game-ready': (payload) => {
    matchmakingActions.handleGameReady(payload);
  },
} as const satisfies MatchmakingHandlerMap;

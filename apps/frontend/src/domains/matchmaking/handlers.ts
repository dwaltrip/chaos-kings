import { UserId } from '@kernel/domains/user';
import { GameId } from '@kernel/domains/game';
import type { MatchmakingServerMessage } from '@protocol/domains/matchmaking/server-messages';

import type { HandlerMap } from '@/ws-lib';
import { matchmakingActions } from '@/domains/matchmaking/actions';

type MatchmakingHandlerMap = HandlerMap<MatchmakingServerMessage>;

const matchmakingHandlers = {
  'matchmaking:queue-status': (payload) => {
    matchmakingActions.handleQueueStatus(payload);
  },

  'matchmaking:early-start-status': (payload) => {
    matchmakingActions.handleEarlyStartStatus({
      voters: payload.voters.map(UserId),
      queueSize: payload.queueSize,
      allVoted: payload.allVoted,
    });
  },

  'matchmaking:game-ready': (payload) => {
    matchmakingActions.handleGameReady(GameId(payload.gameId));
  },
} as const satisfies MatchmakingHandlerMap;

export { matchmakingHandlers };

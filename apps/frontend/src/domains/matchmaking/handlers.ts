import { UserId, GameId } from '@kernel/ids';
import type { MatchmakingServerMessage } from '@protocol/domains/matchmaking/server-messages';

import type { HandlerMap } from '@/ws-lib';
import {
  updateQueueStatus,
  updateEarlyStartStatus,
  handleGameReady,
} from '@/domains/matchmaking/actions';

type MatchmakingHandlerMap = HandlerMap<MatchmakingServerMessage>;

const matchmakingHandlers = {
  'matchmaking:queue-status': (payload) => {
    updateQueueStatus(payload.queueSize, payload.playersNeeded);
  },

  'matchmaking:early-start-status': (payload) => {
    updateEarlyStartStatus(
      payload.voters.map(UserId),
      payload.queueSize,
      payload.allVoted,
    );
  },

  'matchmaking:game-ready': (payload) => {
    handleGameReady(GameId(payload.gameId));
  },
} as const satisfies MatchmakingHandlerMap;

export { matchmakingHandlers };

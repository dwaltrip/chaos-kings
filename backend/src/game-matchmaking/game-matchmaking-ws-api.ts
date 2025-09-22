import { DomainAPI } from '@/websocket/api';
import {
  GAME_MATCHMAKING_DOMAIN,
  type GameMatchmakingClientMessageType,
} from '@common/types/game-matchmaking';
import { joinQueue, leaveQueue } from './actions';
import { earlyStartVote } from './actions/early-start-vote-action';

// -----------------------------------------------------------------------
// TODO: Message types can be client -> server and / or server -> client.
// The current architecture doens't reflect the "or" part.
// The "...MessagType" type defs should be split into two.
// -----------------------------------------------------------------------
const GameMatchmakingWsAPI = new DomainAPI<GameMatchmakingClientMessageType>(
  GAME_MATCHMAKING_DOMAIN,
  {
    'join-queue': (data, wsActions) => {
      const user = data.user;
      if (!user) return;
      return joinQueue(Number(user.id), user.username, wsActions);
    },
    'leave-queue': (data, wsActions) => {
      const user = data.user;
      if (!user) return;
      return leaveQueue(Number(user.id), wsActions);
    },
    'early-start-vote': (data, wsActions) => {
      const user = data.user;
      if (!user) return;
      const vote = !!(data as any).payload?.vote;
      return earlyStartVote(Number(user.id), vote, wsActions);
    },
  },
);

export { GameMatchmakingWsAPI };

import { DomainAPI } from '@/websocket/api';
import {
  GAME_MATCHMAKING_DOMAIN,
  type GameMatchmakingClientMessageType,
} from '@common/types/game-matchmaking';
import { joinQueue, leaveQueue } from './actions';
import { earlyStartVote } from './actions/early-start-vote-action';
import { createMatchmakingEffects } from '@/game-matchmaking/ws-effects';

// -----------------------------------------------------------------------
// TODO: Message types can be client -> server and / or server -> client.
// The current architecture doens't reflect the "or" part.
// The "...MessagType" type defs should be split into two.
// -----------------------------------------------------------------------
const GameMatchmakingWsAPI = new DomainAPI<GameMatchmakingClientMessageType>(
  GAME_MATCHMAKING_DOMAIN,
  {
    'join-queue': async (data, wsActions) => {
      const user = data.user;
      if (!user) return;
      const effects = createMatchmakingEffects(wsActions);
      return joinQueue(Number(user.id), user.username, effects);
    },
    'leave-queue': async (data, wsActions) => {
      const user = data.user;
      if (!user) return;
      const effects = createMatchmakingEffects(wsActions);
      return leaveQueue(Number(user.id), effects);
    },
    'early-start-vote': async (data, wsActions) => {
      const user = data.user;
      if (!user) return;
      const vote = !!(data as any).payload?.vote;
      const effects = createMatchmakingEffects(wsActions);
      return earlyStartVote(Number(user.id), vote, effects);
    },
  },
);

export { GameMatchmakingWsAPI };

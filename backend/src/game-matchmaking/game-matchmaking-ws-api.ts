import {
  GAME_MATCHMAKING_DOMAIN,
  type GameMatchmakingServerInbound,
} from '@common/types/game-matchmaking';
import { joinQueue, leaveQueue } from './actions';
import { earlyStartVote } from './actions/early-start-vote-action';
import { createMatchmakingEffects } from '@/game-matchmaking/ws-effects';

// -----------------------------------------------------------------------
// TODO: Message types can be client -> server and / or server -> client.
// The current architecture doens't reflect the "or" part.
// The "...MessagType" type defs should be split into two.
// -----------------------------------------------------------------------
function handleGameMatchmakingMessage(
  msg: GameMatchmakingServerInbound,
  wsActions: any,
): void {
  const effects = createMatchmakingEffects(wsActions);

  switch (msg.type) {
    case 'join-queue': {
      const user = msg.user;
      if (!user) return;
      void joinQueue(Number(user.id), user.username, effects);
      break;
    }
    case 'leave-queue': {
      const user = msg.user;
      if (!user) return;
      void leaveQueue(Number(user.id), effects);
      break;
    }
    case 'early-start-vote': {
      const user = msg.user;
      if (!user) return;
      const { vote } = msg.payload;
      void earlyStartVote(Number(user.id), vote, effects);
      break;
    }
    default:
      break;
  }
}

export { GAME_MATCHMAKING_DOMAIN, handleGameMatchmakingMessage };

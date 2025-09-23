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
type RegisterFn = (
  domain: string,
  handler: (data: any, actions: any) => void,
) => void;

function registerGameMatchmakingWsHandlers(register: RegisterFn): void {
  register(GAME_MATCHMAKING_DOMAIN, (data, wsActions) => {
    const msg = data as GameMatchmakingServerInbound;
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
  });
}

export { registerGameMatchmakingWsHandlers };

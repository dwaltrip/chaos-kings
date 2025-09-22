import { DomainAPI } from '@/websocket/api';
import {
  GAME_MATCHMAKING_DOMAIN,
  type GameMatchmakingClientMessageType,
} from '@common/types/game-matchmaking';
import {
  handleJoinQueue,
  handleLeaveQueue,
  handleQueueStatus,
} from './actions';
import { handleEarlyStartVote } from './actions/early-start-vote-action';

// -----------------------------------------------------------------------
// TODO: Message types can be client -> server and / or server -> client.
// The current architecture doens't reflect the "or" part.
// The "...MessagType" type defs should be split into two.
// -----------------------------------------------------------------------
const GameMatchmakingWsAPI = new DomainAPI<GameMatchmakingClientMessageType>(
  GAME_MATCHMAKING_DOMAIN,
  {
    'join-queue': handleJoinQueue,
    'leave-queue': handleLeaveQueue,
    'early-start-vote': handleEarlyStartVote,
  },
);

export { GameMatchmakingWsAPI };

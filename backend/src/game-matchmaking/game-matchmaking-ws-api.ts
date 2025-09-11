import { DomainAPI } from '@/websocket/api';
import {
  GameMatchmaking,
  GameMatchmakingMessageType,
  GAME_MATCHMAKING_DOMAIN,
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
const GameMatchmakingWsAPI = new DomainAPI<GameMatchmakingMessageType>(
  GAME_MATCHMAKING_DOMAIN,
  {
    'join-queue': handleJoinQueue,
    'leave-queue': handleLeaveQueue,
    'queue-status': handleQueueStatus,
    'early-start-vote': handleEarlyStartVote,
    // TODO: remove this once we fix the types.
    'game-ready': (data: GameMatchmaking.GameReadyMessage, wsActions) => {
      // NOT NEEDED! (This is sent by the server to clients when a game is ready)
      // Clients do not send this message.
      // See the TODO at the top of this file.
    },
    // TODO: remove this once we fix the types.
    'early-start-status': (
      data: GameMatchmaking.EarlyStartStatusMessage,
      wsActions,
    ) => {
      // NOT NEEDED! (server -> client only)
    },
  },
);

export { GameMatchmakingWsAPI };

import { DomainAPI } from '@/websocket/api';
import {
  GameMatchmaking,
  GameMatchmakingMessageType,
  GAME_MATCHMAKING_DOMAIN
} from '@common/types/game-matchmaking';
import {
  handleJoinQueue,
  handleLeaveQueue,
  handleQueueStatus
} from './actions';

// -----------------------------------------------------------------------
// TODO: Message types can be client -> server and / or server -> client.
// The current architecture doens't reflect the "or" part.
// The "...MessagType" type defs should be split into two.
// -----------------------------------------------------------------------
const GameMatchmakingWsAPI = new DomainAPI<GameMatchmakingMessageType>(GAME_MATCHMAKING_DOMAIN, {
  'join-queue': handleJoinQueue,
  'leave-queue': handleLeaveQueue,
  'queue-status': handleQueueStatus,
  // TODO: remove this once we fix the types.
  'game-ready': (data: GameMatchmaking.GameReadyMessage, wsActions) => {
    // NOT NEEDED! (This is sent by the server to clients when a game is ready)
    // Clients do not send this message.
    // See the TODO at the top of this file.
  },
});

export { GameMatchmakingWsAPI };


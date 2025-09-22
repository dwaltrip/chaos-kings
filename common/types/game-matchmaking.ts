import type {
  WsClientEnvelope,
  WsServerOutbound,
} from '@common/types/websockets';

const GAME_MATCHMAKING_DOMAIN = 'game-matchmaking';

// Directional message types
type GameMatchmakingClientMessageType =
  | 'join-queue'
  | 'leave-queue'
  | 'early-start-vote';

type GameMatchmakingServerMessageType =
  | 'queue-status'
  | 'early-start-status'
  | 'game-ready';

// Client → Server messages (sent by clients)
namespace GameMatchmakingClient {
  export interface JoinQueueMessage extends WsClientEnvelope {
    type: 'join-queue';
    payload: null;
  }

  export interface LeaveQueueMessage extends WsClientEnvelope {
    type: 'leave-queue';
    payload: null;
  }

  export interface EarlyStartVoteMessage extends WsClientEnvelope {
    type: 'early-start-vote';
    payload: {
      vote: boolean;
    };
  }
}

// Server → Client messages (emitted by server)
namespace GameMatchmakingServer {
  export interface QueueStatusMessage extends WsServerOutbound {
    type: 'queue-status';
    payload: {
      queueSize: number;
      playersNeeded: number;
    };
  }

  export interface EarlyStartStatusMessage extends WsServerOutbound {
    type: 'early-start-status';
    payload: {
      voters: string[];
      queueSize: number;
      allVoted: boolean;
    };
  }

  export interface GameReadyMessage extends WsServerOutbound {
    type: 'game-ready';
    payload: {
      gameId: number;
    };
  }
}

export {
  GAME_MATCHMAKING_DOMAIN,
  type GameMatchmakingClientMessageType,
  type GameMatchmakingServerMessageType,
  type GameMatchmakingClient,
  type GameMatchmakingServer,
};

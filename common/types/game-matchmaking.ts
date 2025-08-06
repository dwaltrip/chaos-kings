import type { WsMessage } from '@common/types/websockets';
import type { User } from '@common/types/user';

const GAME_MATCHMAKING_DOMAIN = 'game-matchmaking';

type GameMatchmakingMessageType = (
  'join-queue' |
  'leave-queue' |
  'queue-status' |
  'game-ready'
);

namespace GameMatchmaking {
  export interface GameMatchmakingMessage extends WsMessage {
    payload: {
      content: string;
      room: string;
      timestamp: number;
      user?: User;
    }
  }

  export interface JoinQueueMessage extends WsMessage {
    payload: null;
  }

  export interface LeaveQueueMessage extends WsMessage {
    payload: null;
  }

  export interface QueueStatusMessage extends WsMessage {
    payload: {
      queueSize: number;
      playersNeeded: number;
    }
  }

  export interface GameReadyMessage extends WsMessage {
    payload: {
      gameId: string;
    }
  }
}

export {
  GAME_MATCHMAKING_DOMAIN,
  type GameMatchmaking,
  type GameMatchmakingMessageType
};

import type { WsMessage } from '@common/types/websockets';
import type { BoardState, Movement, Coord } from '@core/types';

const GAMEPLAY_DOMAIN = 'gameplay';

type GameplayMessageType =
  | 'move-request'
  | 'cancel-moves-request'
  | 'game-state-update'
  | 'game-starting'
  | 'game-started'
  | 'game-ended'
  | 'join-room'
  | 'leave-room';

namespace Gameplay {
  export interface MoveRequest extends WsMessage {
    payload: {
      sourceCoord: Coord;
      direction: Movement;
    };
  }

  export interface CancelMovesRequest extends WsMessage {
    payload: null;
  }

  export interface GameStateUpdate extends WsMessage {
    payload: {
      tick: number;
      boardState: BoardState;
    };
  }

  export interface GameStarting extends WsMessage {
    payload: {
      gameId: number;
      countdown: number;
    };
  }

  export interface GameStarted extends WsMessage {
    payload: {
      gameId: number;
      playerMapping: { playerId: string; playerIndex: number }[];
      boardState: BoardState;
    };
  }

  export interface GameEnded extends WsMessage {
    payload: {
      winner: number;
      reason: 'general_captured' | 'timeout' | 'disconnect';
      finalBoardState: BoardState;
    };
  }

  export interface JoinRoomMessage extends WsMessage {
    payload: {
      room: string;
      timestamp: number;
    };
  }

  export interface LeaveRoomMessage extends WsMessage {
    payload: {
      room: string;
      timestamp: number;
    };
  }
}

function createJoinRoomMessage(room: string): WsMessage {
  return {
    domain: GAMEPLAY_DOMAIN,
    type: 'join-room',
    payload: {
      room,
      timestamp: Date.now(),
    },
  };
}

function createLeaveRoomMessage(room: string): WsMessage {
  return {
    domain: GAMEPLAY_DOMAIN,
    type: 'leave-room',
    payload: {
      room,
      timestamp: Date.now(),
    },
  };
}

export {
  GAMEPLAY_DOMAIN,
  createJoinRoomMessage,
  createLeaveRoomMessage,
  type Gameplay,
  type GameplayMessageType,
};

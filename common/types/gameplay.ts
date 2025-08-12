import type { WsMessage } from '@common/types/websockets';
import type { BoardState, Movement, Coord } from '@core/types';

const GAMEPLAY_DOMAIN = 'gameplay';

type GameplayMessageType = (
  'move-request' |
  'cancel-moves-request' |
  'game-state-update' |
  'game-started' |
  'game-ended'
);

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

  export interface GameStarted extends WsMessage {
    payload: {
      gameId: number;
      playerMapping: { playerId: string, playerIndex: number }[];
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
}

export {
  GAMEPLAY_DOMAIN,
  type Gameplay,
  type GameplayMessageType
};
import type { WsMessage } from '@common/types/websockets';
import type { BoardState, Direction, Coord } from '@core/types';
import type { GameWithPlayers } from '@common/types/games';

const GAMEPLAY_DOMAIN = 'gameplay';

type GameplayMessageType =
  | 'move-request'
  | 'undo-move-request'
  | 'cancel-moves-request'
  | 'game-state-update'
  | 'game-starting'
  | 'game-started'
  | 'game-ended'
  | 'join-room'
  | 'leave-room';

type PlayerIndex = number;
interface Movement {
  sourceCoord: Coord;
  direction: Direction;
}
type PlayerQueuesMap = Record<PlayerIndex, Array<Movement>>;

namespace Gameplay {
  export interface MoveRequest extends WsMessage {
    payload: {
      sourceCoord: Coord;
      direction: Direction;
    };
  }

  export interface UndoMoveRequest extends WsMessage {
    payload: {
      gameId: number;
    };
  }

  export interface CancelMovesRequest extends WsMessage {
    payload: null;
  }

  export interface GameStateUpdate extends WsMessage {
    payload: {
      tick: number;
      boardState: BoardState;
      playerQueues?: PlayerQueuesMap;
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
      playerMapping: { playerId: string; playerIndex: PlayerIndex }[];
      boardState: BoardState;
      game: GameWithPlayers;
    };
  }

  export interface GameEnded extends WsMessage {
    payload: {
      winner: PlayerIndex;
      finalBoardState: BoardState;
    };
  }
}

export type { Gameplay, GameplayMessageType, Movement, PlayerQueuesMap };
export { GAMEPLAY_DOMAIN };

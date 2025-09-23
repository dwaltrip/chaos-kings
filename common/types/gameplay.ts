import type {
  WsClientEnvelope,
  WsServerOutbound,
  WsServerInbound,
} from '@common/types/websockets';
import type { BoardState, Direction, Coord } from '@core/types';
import type { GameWithPlayers } from '@common/types/games';

const GAMEPLAY_DOMAIN = 'gameplay';

// Directional message types
type GameplayClientMessageType =
  | 'join-room'
  | 'leave-room'
  | 'move-request'
  | 'cancel-moves-request'
  | 'undo-move-request';

type GameplayServerMessageType =
  | 'game-state-update'
  | 'game-starting'
  | 'game-started'
  | 'game-ended';

type PlayerIndex = number;
interface Movement {
  sourceCoord: Coord;
  direction: Direction;
}
type PlayerQueuesMap = Record<PlayerIndex, Array<Movement>>;

// Client → Server messages
namespace GameplayClient {
  export interface JoinRoomMessage extends WsClientEnvelope {
    type: 'join-room';
    payload: { room: string };
  }
  export interface LeaveRoomMessage extends WsClientEnvelope {
    type: 'leave-room';
    payload: { room: string };
  }
  export interface MoveRequest extends WsClientEnvelope {
    type: 'move-request';
    payload: { sourceCoord: Coord; direction: Direction };
  }
  export interface CancelMovesRequest extends WsClientEnvelope {
    type: 'cancel-moves-request';
    payload: null;
  }
  export interface UndoMoveRequest extends WsClientEnvelope {
    type: 'undo-move-request';
    payload: { gameId: number };
  }
}

// Server → Client messages
namespace GameplayServer {
  export interface GameStateUpdate extends WsServerOutbound {
    type: 'game-state-update';
    payload: {
      tick: number;
      boardState: BoardState;
      playerQueues?: PlayerQueuesMap;
    };
  }
  export interface GameStarting extends WsServerOutbound {
    type: 'game-starting';
    payload: { gameId: number; countdown: number };
  }
  export interface GameStarted extends WsServerOutbound {
    type: 'game-started';
    payload: {
      gameId: number;
      playerMapping: { playerId: string; playerIndex: PlayerIndex }[];
      boardState: BoardState;
      game: GameWithPlayers;
    };
  }
  export interface GameEnded extends WsServerOutbound {
    type: 'game-ended';
    payload: { winner: PlayerIndex; finalBoardState: BoardState };
  }
}

// ------------------------------
// Server inbound (typed C→S)
// ------------------------------
interface GameplayJoinRoomInbound {
  type: 'join-room';
  payload: { room: string };
}

interface GameplayLeaveRoomInbound {
  type: 'leave-room';
  payload: { room: string };
}

interface GameplayMoveRequestInbound {
  type: 'move-request';
  payload: { sourceCoord: Coord; direction: Direction };
}

interface GameplayCancelMovesInbound {
  type: 'cancel-moves-request';
  payload: null;
}

interface GameplayUndoMoveInbound {
  type: 'undo-move-request';
  payload: { gameId: number };
}

type GameplayInbound =
  | GameplayJoinRoomInbound
  | GameplayLeaveRoomInbound
  | GameplayMoveRequestInbound
  | GameplayCancelMovesInbound
  | GameplayUndoMoveInbound;

type GameplayServerInbound = Omit<
  WsServerInbound,
  'domain' | 'type' | 'payload'
> & { domain: typeof GAMEPLAY_DOMAIN } & GameplayInbound;

function isGameplayServerInbound(
  data: WsServerInbound,
): data is GameplayServerInbound {
  return data.domain === GAMEPLAY_DOMAIN;
}

export {
  GAMEPLAY_DOMAIN,
  type GameplayClientMessageType,
  type GameplayServerMessageType,
  type Movement,
  type PlayerQueuesMap,
  type GameplayClient,
  type GameplayServer,
  type PlayerIndex,
  type GameplayInbound,
  type GameplayServerInbound,
  type GameplayJoinRoomInbound,
  type GameplayLeaveRoomInbound,
  type GameplayMoveRequestInbound,
  type GameplayCancelMovesInbound,
  type GameplayUndoMoveInbound,
  isGameplayServerInbound,
};

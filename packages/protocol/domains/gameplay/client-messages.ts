import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { EmptyPayload, ExtractMsg } from '@protocol/utils/type-helpers';
import type { Coord, Direction } from '@core/types';

type GameplayClientPayloadMap = {
  'gameplay:join-game': {
    gameId: number;
  };

  'gameplay:leave-game': {
    gameId: number;
  };

  'gameplay:move-request': {
    sourceCoord: Coord;
    direction: Direction;
  };

  'gameplay:cancel-moves': EmptyPayload;

  'gameplay:undo-move': {
    gameId: number;
  };
};

type GameplayClientMessage = MessageUnion<GameplayClientPayloadMap>;
type JoinGameMessage = ExtractMsg<GameplayClientMessage, 'gameplay:join-game'>;
type LeaveGameMessage = ExtractMsg<GameplayClientMessage, 'gameplay:leave-game'>;
type MoveRequestMessage = ExtractMsg<GameplayClientMessage, 'gameplay:move-request'>;
type CancelMovesMessage = ExtractMsg<GameplayClientMessage, 'gameplay:cancel-moves'>;
type UndoMoveMessage = ExtractMsg<GameplayClientMessage, 'gameplay:undo-move'>;

const MsgCreators = {
  createJoinGameMessage: (gameId: number): JoinGameMessage => ({
    type: 'gameplay:join-game',
    payload: { gameId },
  }),

  createLeaveGameMessage: (gameId: number): LeaveGameMessage => ({
    type: 'gameplay:leave-game',
    payload: { gameId },
  }),

  createMoveRequestMessage: (
    sourceCoord: Coord,
    direction: Direction,
  ): MoveRequestMessage => ({
    type: 'gameplay:move-request',
    payload: { sourceCoord, direction },
  }),

  createCancelMovesMessage: (): CancelMovesMessage => ({
    type: 'gameplay:cancel-moves',
    payload: {},
  }),

  createUndoMoveMessage: (gameId: number): UndoMoveMessage => ({
    type: 'gameplay:undo-move',
    payload: { gameId },
  }),
} as const;

export type { GameplayClientPayloadMap, GameplayClientMessage };
export { MsgCreators };

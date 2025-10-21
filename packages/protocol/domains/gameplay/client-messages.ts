import { MessageUnion } from '@protocol/utils/message-helpers';
import { EmptyPayload, ExtractMsg } from '@protocol/utils/type-helpers';
import type { Coord, Direction } from '@core/types';

type GameplayClientPayloadMap = {
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
type MoveRequestMessage = ExtractMsg<GameplayClientMessage, 'gameplay:move-request'>;
type CancelMovesMessage = ExtractMsg<GameplayClientMessage, 'gameplay:cancel-moves'>;
type UndoMoveMessage = ExtractMsg<GameplayClientMessage, 'gameplay:undo-move'>;

const MsgCreators = {
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

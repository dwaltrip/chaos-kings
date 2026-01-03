import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { EmptyPayload, ExtractMsg } from '@protocol/utils/type-helpers';

import type { Coord, Direction } from '@core/types';

type PuzzlesClientPayloadMap = {
  'puzzles:start-playing': EmptyPayload;

  'puzzles:move-request': {
    sourceCoord: Coord;
    direction: Direction;
  };

  'puzzles:cancel-moves': EmptyPayload;

  'puzzles:undo-move': EmptyPayload;
};

type PuzzlesClientMessage = MessageUnion<PuzzlesClientPayloadMap>;
type PuzzlesStartPlayingMessage = ExtractMsg<
  PuzzlesClientMessage,
  'puzzles:start-playing'
>;
type MoveRequestMessage = ExtractMsg<PuzzlesClientMessage, 'puzzles:move-request'>;
type CancelMovesMessage = ExtractMsg<PuzzlesClientMessage, 'puzzles:cancel-moves'>;
type UndoMoveMessage = ExtractMsg<PuzzlesClientMessage, 'puzzles:undo-move'>;

const MsgCreators = {
  createStartPlayingMessage: (gameId: number): PuzzlesStartPlayingMessage => ({
    type: 'puzzles:start-playing',
    payload: {},
  }),

  createMoveRequestMessage: (
    sourceCoord: Coord,
    direction: Direction,
  ): MoveRequestMessage => ({
    type: 'puzzles:move-request',
    payload: { sourceCoord, direction },
  }),

  createCancelMovesMessage: (): CancelMovesMessage => ({
    type: 'puzzles:cancel-moves',
    payload: {},
  }),

  createUndoMoveMessage: (): UndoMoveMessage => ({
    type: 'puzzles:undo-move',
    payload: {},
  }),
} as const;

export type { PuzzlesClientPayloadMap, PuzzlesClientMessage };
export { MsgCreators };

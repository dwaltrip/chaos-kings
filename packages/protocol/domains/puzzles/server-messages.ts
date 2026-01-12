import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { ExtractMsg } from '@protocol/utils/type-helpers';

import type { BoardState, Movement } from '@core/types';

// Result type for best-start puzzle (will move to @core/puzzles later)
interface BestStartResult {
  landCount: number;
  armyCount: number;
}

type PuzzlesServerPayloadMap = {
  'puzzles:state-update': {
    tick: number;
    board: BoardState;
    moveQueue: Movement[];
  };
  'puzzles:end-puzzle': {
    finalBoard: BoardState;
    result: BestStartResult;
  };
};

type PuzzlesServerMessage = MessageUnion<PuzzlesServerPayloadMap>;
type StateUpdateMessage = ExtractMsg<PuzzlesServerMessage, 'puzzles:state-update'>;
type EndPuzzleMessage = ExtractMsg<PuzzlesServerMessage, 'puzzles:end-puzzle'>;

const MsgCreators = {
  createStateUpdateMessage: (
    tick: number,
    board: BoardState,
    moveQueue: Movement[],
  ): StateUpdateMessage => ({
    type: 'puzzles:state-update',
    payload: { tick, board, moveQueue },
  }),

  createEndPuzzleMessage: (
    finalBoard: BoardState,
    result: BestStartResult,
  ): EndPuzzleMessage => ({
    type: 'puzzles:end-puzzle',
    payload: { finalBoard, result },
  }),
};

export type { PuzzlesServerPayloadMap, PuzzlesServerMessage, BestStartResult };
export { MsgCreators };

import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { ExtractMsg } from '@protocol/utils/type-helpers';

// -----------------------------------------------------------
// TODO: Fix usages of `any` in this file
// -----------------------------------------------------------

type PuzzlesServerPayloadMap = {
  'puzzles:state-update': {
    board: any;
  };
  'puzzles:end-puzzle': {
    finalBoardState: any;
  };
};

type PuzzlesServerMessage = MessageUnion<PuzzlesServerPayloadMap>;
type StateUpdateMessage = ExtractMsg<PuzzlesServerMessage, 'puzzles:state-update'>;
type EndPuzzleMessage = ExtractMsg<PuzzlesServerMessage, 'puzzles:end-puzzle'>;

const MsgCreators = {
  createStateUpdateMessage: (board: any): StateUpdateMessage => ({
    type: 'puzzles:state-update',
    payload: { board },
  }),

  // EndPuzzleMessage
};

export type { PuzzlesServerPayloadMap, PuzzlesServerMessage };
export { MsgCreators };

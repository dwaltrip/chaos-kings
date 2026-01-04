import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { ExtractMsg } from '@protocol/utils/type-helpers';

type PuzzlesServerPayloadMap = {
  'puzzles:state-update': {
    board: any;
  };
  'puzzles:end-puzzle': {
    finalBoardState: any;
  };
};

type PuzzlesServerMessage = MessageUnion<PuzzlesServerPayloadMap>;
type StateUpdateMessage = ExtractMsg<PuzzlesServerMessage, 'puzzle:state-update'>;
type EndPuzzleMessage = ExtractMsg<PuzzlesServerMessage, 'puzzle:end-puzzle'>;

const MsgCreators = {
  // StateUpdateMessage
  // EndPuzzleMessage
};

export type { PuzzlesServerPayloadMap, PuzzlesServerMessage };
export { MsgCreators };

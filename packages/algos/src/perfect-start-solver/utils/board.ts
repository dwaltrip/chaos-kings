import { Board, type FlatBoard } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { makeBoard } from '../test-boards';

export interface BoardCtx {
  flatBoard: FlatBoard;
  generalPos: number;
}

export function loadBoardCtx(boardName: string): BoardCtx {
  const testBoard = makeBoard(boardName);
  const flatBoard = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    flatBoard,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );
  return { flatBoard, generalPos };
}

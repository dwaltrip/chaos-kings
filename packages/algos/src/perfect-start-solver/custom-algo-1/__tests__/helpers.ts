import { Board } from '@/core-next/flat-board';
import type { FlatBoard } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { makeBoard } from '../../test-boards';

interface TestBoardResult {
  board: FlatBoard;
  generalPos: number;
}

function makeTestBoard(name: string): TestBoardResult {
  const testBoard = makeBoard(name);
  const board = fromBoardState(testBoard.board, 1);
  const generalPos = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );
  return { board, generalPos };
}

export type { TestBoardResult };
export { makeTestBoard };

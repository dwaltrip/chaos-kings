import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { makeBoard } from '../../test-boards';
import { genPathsDP } from '../gen-paths';

// const b7x7 = makeBoard('open-11x11');
const b7x7 = makeBoard('open-11x11');
const board = fromBoardState(b7x7.board, 1);

const pathsByLen = genPathsDP(board, Board.toIndex(board, 3, 3), 12);

// console.log('-------------------');
// console.log(pathsByLen);
// console.log('-------------------');

for (let [k, paths] of pathsByLen.entries()) {
  console.log(`${k}: ${paths.length}`);
}

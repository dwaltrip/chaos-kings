import { FlatBoard } from '@/core-next/flat-board';
import { formatBoard } from '../format';

function solve(board: FlatBoard) {
  console.log('------------- solver ---------------');
  const prettyBoard = formatBoard(board);
  console.log('------------- board ----------------');
  console.log(prettyBoard);
}

export { solve };

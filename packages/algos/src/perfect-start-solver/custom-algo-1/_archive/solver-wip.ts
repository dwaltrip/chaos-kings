import { type FlatBoard, Board, TileType } from '@/core-next/flat-board';
import { formatBoard } from '../format';
import { Direction } from '@core/types';

function solve(board: FlatBoard) {
  console.log('------------- solver ---------------');
  const prettyBoard = formatBoard(board);
  console.log('------------- board ----------------');
  console.log(prettyBoard);

  const center = Board.toIndex(
    board,
    Math.floor(board.width / 2),
    Math.floor(board.height / 2),
  );

  const paths = [
    makePath(board, center, 3),
    makePath(board, center, 6),
    makePath(board, center, 15),
  ];

  for (let path of paths) {
    console.log(path);
  }
}

function makePath(
  board: FlatBoard,
  idx: number,
  // direction: Direction,
  len: number,
): number[] {
  // 1. go left until you hit obstacle or run out of moves
  // 2. go up 1 tile
  // 3. repeat, go bakck to 1

  if (!isOnBoard(board, idx)) {
    throw new Error(
      `makePath: idx ${idx} is not on board (${board.width}x${board.height})`,
    );
  }

  const path = [];
  const pathSet = new Set();
  let curr: number | null = idx;

  const dirs = [Direction.LEFT, Direction.UP, Direction.RIGHT, Direction.DOWN];

  function getNextTile(num: number): number | null {
    for (let dir of dirs) {
      const candidate = Board.neighbor(board, num, dir);
      if (!isOnBoard(board, candidate)) {
        continue;
      }
      if (board.types[candidate] !== TileType.BLANK) {
        continue;
      }
      if (pathSet.has(candidate)) {
        continue;
      }
      return candidate;
    }
    return null;
  }

  // get first candidate
  curr = getNextTile(curr);
  let iters = 0;

  while (true) {
    // 100 iteration safety bail out. Should not happen, if it does there's a bug.
    if (curr === null || path.length === len || iters >= 100) {
      break;
    }

    // add successfull candidate to path
    path.push(curr);
    pathSet.add(curr);

    // get next candidate
    curr = getNextTile(curr);
    iters++;
  }

  return path;
}

// function isOnLeftEdge(board: FlatBoard, idx: number): boolean {
//   return isOnBoard(board, idx) && idx % board.width == 0;
// }

function isOnBoard(board: FlatBoard, idx: number) {
  return 0 <= idx && idx < board.width * board.height;
}

export { solve };

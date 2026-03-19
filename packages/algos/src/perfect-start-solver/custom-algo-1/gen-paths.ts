import { Direction } from '@core/types';

import { type FlatBoard, Board, TileType } from '@/core-next/flat-board';

type Path = number[];

// path "with set" for membership checking
interface PathWS {
  seq: Path;
  tiles: Set<number>;
}

type PathsByLen = Map<number, Path[]>;

const DIRECTIONS = [Direction.LEFT, Direction.UP, Direction.RIGHT, Direction.DOWN];

function cloneAndExtendPath(path: PathWS, newTip: number) {
  return {
    seq: path.seq.concat(newTip),
    tiles: new Set(path.tiles).add(newTip),
    tip: newTip,
  };
}

function getAllChildPaths(board: FlatBoard, path: PathWS): PathWS[] {
  const paths = [];
  for (let dir of DIRECTIONS) {
    const next = Board.neighbor(board, path.seq[path.seq.length - 1], dir);

    if (!Board.isValidIndex(board, next)) {
      continue;
    }
    if (board.types[next] === TileType.MOUNTAIN) {
      continue;
    }
    if (path.tiles.has(next)) {
      continue;
    }

    paths.push(cloneAndExtendPath(path, next));
  }
  return paths;
}

function genPathsDP(board: FlatBoard, start: number, maxLen: number): PathsByLen {
  if (!Board.isValidIndex(board, start)) {
    throw new Error(`Invalid index: ${start}`);
  }

  const allPaths = new Map<number, PathWS[]>();
  const baseCase = { seq: [start], tiles: new Set([start]) };
  allPaths.set(1, [baseCase]);

  for (let k = 2; k <= maxLen; k++) {
    const nextPathsNested = [];
    const prevPaths = allPaths.get(k - 1) || [];
    for (let path of prevPaths) {
      nextPathsNested.push(getAllChildPaths(board, path));
    }
    allPaths.set(k, nextPathsNested.flat());
  }

  // construct new map from `allPaths`
  return new Map(
    Array.from(allPaths.entries()).map(([k, paths]) => {
      // convert arry of PathWs to array of Path
      return [k, paths.map((path) => path.seq)];
    }),
  );
}

export { genPathsDP };

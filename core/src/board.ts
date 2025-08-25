import { invariant } from '@common/utils/invariant';
import type { BoardState, Coord, Square, PlayerSquare } from '@core/types';
import { Movement, SquareType } from '@core/types';
import { isPlayerSquare } from '@core/square';
import { serializeCoord } from '@core/utils/coordinate-utils';

// TODO: rename this to "isValidMoveTarget" or something
function canMove(
  board: BoardState,
  source: Coord,
  direction: Movement,
): boolean {
  const destCoord = applyDirection(source, direction);
  if (!isCoordValid(board, destCoord)) {
    return false;
  }
  const dest = getSquare(board, destCoord);
  // TODO: make this more robust. should be defined somewhere else
  if (dest.type === SquareType.MOUNTAIN) {
    return false;
  }
  return true;
}

function getSquare(
  board: BoardState,
  coord: Coord,
  movement?: Movement,
): Square {
  if (movement !== undefined) {
    coord = applyDirection(coord, movement);
  }
  invariant(isCoordValid(board, coord), 'Coord is not valid');

  const { x, y } = coord;
  return board.grid[y][x];
}

function isCoordValid(board: BoardState, coord: Coord): boolean {
  const { height, width } = board.size;
  const { x, y } = coord;
  return x >= 0 && x < width && y >= 0 && y < height;
}

function replaceSquare(board: BoardState, coord: Coord, square: Square) {
  invariant(isCoordValid(board, coord), 'Coord is not valid');
  const { x, y } = coord;
  board.grid[y][x] = square;
}

function applyDirection(coord: Coord, direction: Movement): Coord {
  switch (direction) {
    case Movement.UP:
      return { x: coord.x, y: coord.y - 1 };
    case Movement.DOWN:
      return { x: coord.x, y: coord.y + 1 };
    case Movement.LEFT:
      return { x: coord.x - 1, y: coord.y };
    case Movement.RIGHT:
      return { x: coord.x + 1, y: coord.y };
  }
}

function* iterPlayerSquares(
  board: BoardState,
  playerIndex: number,
): IterableIterator<PlayerSquare> {
  for (let square of board.grid.flat()) {
    if (isPlayerSquare(square) && square.playerIndex === playerIndex) {
      yield square;
    }
  }
}

function getVisibleSquares(
  board: BoardState,
  playerIndex: number,
): Set<string> {
  const visibleCoords = new Set<string>();

  // Get all 8 neighboring directions (including diagonals)
  const directions = [
    { x: -1, y: -1 }, // NW
    { x: 0, y: -1 }, // N
    { x: 1, y: -1 }, // NE
    { x: -1, y: 0 }, // W
    { x: 1, y: 0 }, // E
    { x: -1, y: 1 }, // SW
    { x: 0, y: 1 }, // S
    { x: 1, y: 1 }, // SE
  ];

  // For each square owned by the player
  for (const playerSquare of iterPlayerSquares(board, playerIndex)) {
    // Check all 8 neighboring squares
    for (const direction of directions) {
      const neighborCoord: Coord = {
        x: playerSquare.coord.x + direction.x,
        y: playerSquare.coord.y + direction.y,
      };

      // Only add if the coordinate is valid (within board bounds)
      if (isCoordValid(board, neighborCoord)) {
        visibleCoords.add(serializeCoord(neighborCoord));
      }
    }

    // Also add the square the player owns
    visibleCoords.add(serializeCoord(playerSquare.coord));
  }

  return visibleCoords;
}

const Board = {
  canMove,
  getSquare,
  isCoordValid,
  replaceSquare,
  applyDirection,
  isPlayerSquare,
  iterPlayerSquares,
  getVisibleSquares,
};

export { Board };

import { validateMove } from '@core/moves/validate-move';
import { Board } from '@core/board';
import { PlayerSquareType, NeutralSquareType, Direction } from '@core/types';
import type { BoardState, Coord, Square } from '@core/types';

function makeBoard(
  width: number,
  height: number,
  fill?: (coord: Coord) => Square,
): BoardState {
  const grid: Square[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Square[] = [];
    for (let x = 0; x < width; x++) {
      const coord = { x, y };
      row.push(
        fill
          ? fill(coord)
          : ({ type: NeutralSquareType.BLANK, coord } as Square),
      );
    }
    grid.push(row);
  }
  return { grid, size: { width, height } };
}

describe('validateMove', () => {
  test('invalid_coord when source is outside board', () => {
    const board = makeBoard(2, 2);
    const res = validateMove(board, 0, { x: -1, y: 0 }, Direction.RIGHT);
    expect(res).toEqual({ ok: false, reason: 'invalid_coord' });
  });

  test('not_owner when source is not owned by player', () => {
    const board = makeBoard(2, 2);
    // Put a player 1 army at 0,0
    (board.grid[0][0] as any) = {
      type: PlayerSquareType.ARMY,
      coord: { x: 0, y: 0 },
      playerIndex: 1,
      units: 5,
    };
    const res = validateMove(board, 0, { x: 0, y: 0 }, Direction.RIGHT);
    expect(res).toEqual({ ok: false, reason: 'not_owner' });
  });

  test('insufficient_units when source has <= 1 unit', () => {
    const board = makeBoard(2, 2);
    (board.grid[0][0] as any) = {
      type: PlayerSquareType.ARMY,
      coord: { x: 0, y: 0 },
      playerIndex: 0,
      units: 1,
    };
    const res = validateMove(board, 0, { x: 0, y: 0 }, Direction.RIGHT);
    expect(res).toEqual({ ok: false, reason: 'insufficient_units' });
  });

  test('blocked_destination when moving into a mountain', () => {
    const board = makeBoard(2, 1);
    (board.grid[0][0] as any) = {
      type: PlayerSquareType.ARMY,
      coord: { x: 0, y: 0 },
      playerIndex: 0,
      units: 3,
    };
    (board.grid[0][1] as any) = {
      type: NeutralSquareType.MOUNTAIN,
      coord: { x: 1, y: 0 },
    };
    const res = validateMove(board, 0, { x: 0, y: 0 }, Direction.RIGHT);
    expect(res).toEqual({ ok: false, reason: 'blocked_destination' });
  });

  test('ok for valid move into blank', () => {
    const board = makeBoard(2, 1);
    (board.grid[0][0] as any) = {
      type: PlayerSquareType.ARMY,
      coord: { x: 0, y: 0 },
      playerIndex: 0,
      units: 3,
    };
    const res = validateMove(board, 0, { x: 0, y: 0 }, Direction.RIGHT);
    expect(res).toEqual({ ok: true });
  });
});

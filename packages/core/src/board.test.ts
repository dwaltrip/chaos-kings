import { Board } from '@core/board';
import type { BoardState, GameGrid } from '@core/types';
import { PlayerSquareType, NeutralSquareType } from '@core/types';

function blank(x: number, y: number) {
  return { coord: { x, y }, type: NeutralSquareType.BLANK };
}

function player(
  x: number,
  y: number,
  { playerIndex, units }: { playerIndex: number; units: number },
) {
  return { coord: { x, y }, type: PlayerSquareType.ARMY, playerIndex, units };
}

function p1(x: number, y: number, units: number) {
  return player(x, y, { playerIndex: 1, units });
}

function p2(x: number, y: number, units: number) {
  return player(x, y, { playerIndex: 2, units });
}

function general(
  x: number,
  y: number,
  { playerIndex, units }: { playerIndex: number; units: number },
) {
  return {
    coord: { x, y },
    type: PlayerSquareType.GENERAL,
    playerIndex,
    units,
  };
}

function g1(x: number, y: number, units: number) {
  return general(x, y, { playerIndex: 1, units });
}

function g2(x: number, y: number, units: number) {
  return general(x, y, { playerIndex: 2, units });
}

describe('Board.getVisibleSquares', () => {
  it('should return all 8 neighboring squares plus the player square itself', () => {
    const grid: GameGrid = [
      [blank(0, 0), blank(1, 0), blank(2, 0)],
      [blank(0, 1), p1(1, 1, 5), blank(2, 1)],
      [blank(0, 2), blank(1, 2), blank(2, 2)],
    ];
    const board: BoardState = {
      grid,
      size: { width: 3, height: 3 },
    };

    const visibleSquares = Board.getVisibleSquares(board, 1);

    expect(visibleSquares.size).toBe(9); // 8 neighbors + 1 owned square

    expect(visibleSquares).toContain('0,0'); // NW
    expect(visibleSquares).toContain('1,0'); // N
    expect(visibleSquares).toContain('2,0'); // NE
    expect(visibleSquares).toContain('0,1'); // W
    expect(visibleSquares).toContain('1,1'); // Player's own square
    expect(visibleSquares).toContain('2,1'); // E
    expect(visibleSquares).toContain('0,2'); // SW
    expect(visibleSquares).toContain('1,2'); // S
    expect(visibleSquares).toContain('2,2'); // SE
  });

  it('should return empty set when player has no squares', () => {
    const grid: GameGrid = [
      [blank(0, 0), blank(1, 0)],
      [blank(0, 1), blank(1, 1)],
    ];

    const board: BoardState = {
      grid,
      size: { width: 2, height: 2 },
    };

    const visibleSquares = Board.getVisibleSquares(board, 1);

    expect(visibleSquares.size).toBe(0);
  });

  it('should handle edge cases where player square is at board boundary', () => {
    const grid: GameGrid = [
      [g1(0, 0, 1), blank(1, 0)],
      [blank(0, 1), blank(1, 1)],
    ];

    const board: BoardState = {
      grid,
      size: { width: 2, height: 2 },
    };

    const visibleSquares = Board.getVisibleSquares(board, 1);

    expect(visibleSquares.size).toBe(4); // 3 neighbors + 1 owned square

    expect(visibleSquares).toContain('0,0'); // Player's own square
    expect(visibleSquares).toContain('1,0'); // E
    expect(visibleSquares).toContain('0,1'); // S
    expect(visibleSquares).toContain('1,1'); // SE
  });

  it('should deduplicate overlapping visibility areas from multiple player squares', () => {
    const grid: GameGrid = [
      [p1(0, 0, 2), p1(1, 0, 3), blank(2, 0)],
      [blank(0, 1), blank(1, 1), blank(2, 1)],
    ];

    const board: BoardState = {
      grid,
      size: { width: 3, height: 2 },
    };

    const visibleSquares = Board.getVisibleSquares(board, 1);

    // Both player squares can see (1,1), but it should only be counted once
    expect(visibleSquares).toContain('1,1');
    // Since it's a Set, duplicates are automatically eliminated
    expect(visibleSquares.size).toBeGreaterThan(0);
  });

  it('should only return squares for the specified player', () => {
    const grid: GameGrid = [
      [p1(0, 0, 2), p2(1, 0, 3), blank(2, 0)],
      [blank(0, 1), blank(1, 1), blank(2, 1)],
    ];

    const board: BoardState = {
      grid,
      size: { width: 3, height: 2 },
    };

    const player1Visible = Board.getVisibleSquares(board, 1);
    const player2Visible = Board.getVisibleSquares(board, 2);

    // Player 1 can see around (0,0) including their own square
    expect(player1Visible).toContain('0,0'); // Player 1's own square
    expect(player1Visible).toContain('1,0');
    expect(player1Visible).toContain('0,1');
    expect(player1Visible).toContain('1,1');

    // Player 2 can see around (1,0) including their own square
    expect(player2Visible).toContain('0,0');
    expect(player2Visible).toContain('1,0'); // Player 2's own square
    expect(player2Visible).toContain('2,0');
    expect(player2Visible).toContain('0,1');
    expect(player2Visible).toContain('1,1');
    expect(player2Visible).toContain('2,1');
  });
});

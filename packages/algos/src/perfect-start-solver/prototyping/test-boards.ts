import type { BoardState, Coord, Square } from '@core/types';
import { SquareType } from '@core/types';

interface TestBoard {
  name: string;
  board: BoardState;
  generalCoord: Coord;
}

// TODO: replace with board factory (parseBoard from text) once we design boards
function makeBoard(name: string): TestBoard {
  if (name === 'open-7x7') {
    return makeOpenField(7, 7, { x: 3, y: 3 });
  }
  throw new Error(`Unknown board: ${name}`);
}

function makeOpenField(width: number, height: number, generalCoord: Coord): TestBoard {
  const grid: Square[][] = [];

  for (let y = 0; y < height; y++) {
    const row: Square[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ type: SquareType.BLANK, coord: { x, y } });
    }
    grid.push(row);
  }

  grid[generalCoord.y][generalCoord.x] = {
    type: SquareType.GENERAL,
    coord: generalCoord,
    playerIndex: 0,
    units: 1,
  };

  return {
    name: `open-${width}x${height}`,
    board: { grid, size: { width, height } },
    generalCoord,
  };
}

export type { TestBoard };
export { makeBoard };

import type { BoardState, Coord, Square } from '@core/types';
import { SquareType } from '@core/types';

import { Board, FlatBoard } from '@core-next/flat-board';
import { fromBoardState } from '@core-next/convert';

interface TestBoard {
  name: string;
  board: BoardState;
  generalCoord: Coord;
}

// interface TestFlatBoard {
//   board: FlatBoard
//   general: number;
// }

// Parse a text grid into a TestBoard.
// Supports two formats:
//   Old (packed):  .G.MMM..    (. = blank, M = mountain)
//   New (spaced):  · G · # # # · ·   (· = blank, # = mountain)
// Legend: G = general (player 0). Rows separated by newlines.
function parseBoard(name: string, text: string): TestBoard {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const height = lines.length;

  // Detect format: new format uses middle-dot (·) or hash (#)
  const isSpaced = lines[0].includes('·') || lines[0].includes('#');

  const parsedRows: string[][] = lines.map((line) => {
    if (isSpaced) {
      return line.split(' ').filter((tok) => tok.length > 0);
    }
    return line.split('');
  });

  const width = parsedRows[0].length;
  for (let y = 0; y < height; y++) {
    if (parsedRows[y].length !== width) {
      throw new Error(
        `Board "${name}": row length mismatch — ` +
          `row 0 has ${width} cols, row ${y} has ${parsedRows[y].length} cols`,
      );
    }
  }

  let generalCoord: Coord | null = null;
  const grid: Square[][] = [];

  for (let y = 0; y < height; y++) {
    const row: Square[] = [];
    for (let x = 0; x < width; x++) {
      const ch = parsedRows[y][x];
      const coord = { x, y };

      if (ch === 'G') {
        generalCoord = coord;
        row.push({ type: SquareType.GENERAL, coord, playerIndex: 0, units: 1 });
      } else if (ch === 'M' || ch === '#') {
        row.push({ type: SquareType.MOUNTAIN, coord });
      } else {
        row.push({ type: SquareType.BLANK, coord });
      }
    }
    grid.push(row);
  }

  if (!generalCoord) throw new Error(`Board "${name}" has no general (G)`);

  return {
    name,
    board: { grid, size: { width, height } },
    generalCoord,
  };
}

function parseFlatBaord(text: string): { board: FlatBoard; general: number } {
  const { name: _, board: boardState, generalCoord } = parseBoard('', text);
  const board = fromBoardState(boardState, 1);
  return {
    board,
    general: Board.toIndex(board, generalCoord.x, generalCoord.y),
  };
}

// export type { TestBoard, TestFlatBoard } ;
export type { TestBoard };
export { parseBoard, parseFlatBaord };

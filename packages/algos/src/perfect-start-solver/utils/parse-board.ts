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
// Legend: . = blank, M = mountain, G = general (player 0)
// Rows separated by newlines; leading/trailing blank lines stripped.
function parseBoard(name: string, text: string): TestBoard {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const height = lines.length;
  const width = lines[0].length;

  let generalCoord: Coord | null = null;
  const grid: Square[][] = [];

  for (let y = 0; y < height; y++) {
    const row: Square[] = [];
    for (let x = 0; x < width; x++) {
      const ch = lines[y][x];
      const coord = { x, y };

      if (ch === 'G') {
        generalCoord = coord;
        row.push({ type: SquareType.GENERAL, coord, playerIndex: 0, units: 1 });
      } else if (ch === 'M') {
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

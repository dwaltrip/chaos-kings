import * as fs from 'fs';
import * as path from 'path';

import type { BoardState, Coord, Square } from '@core/types';
import { SquareType } from '@core/types';

interface TestBoard {
  name: string;
  board: BoardState;
  generalCoord: Coord;
}

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

// -- Board definitions -------------------------------------------------------

// Wide open — baseline. Optimal ~25 land in 50 ticks.
const OPEN_7x7 = parseBoard(
  'open-7x7',
  `
.......
.......
.......
...G...
.......
.......
.......
`,
);

// Scattered mountains — mild routing decisions.
// 6 mountains (~12% density) break up straight-line expansion.
const SPARSE_MTNS_7x7 = parseBoard(
  'sparse-mtns-7x7',
  `
..M....
.......
....M..
...G..M
.M.....
.....M.
..M....
`,
);

// Horizontal wall with one gap — forces pathfinding through chokepoint.
const CORRIDOR_7x7 = parseBoard(
  'corridor-7x7',
  `
.......
.......
...G...
MMMM.MM
.......
.......
.......
`,
);

// Dense mountains (~30% density) creating maze-like paths.
const MAZE_7x7 = parseBoard(
  'maze-7x7',
  `
.M..MM.
...M...
.M.G.M.
.MM...M
....M..
.MM.MM.
..M....
`,
);

// -- 9x9 boards --------------------------------------------------------------

const OPEN_9x9 = parseBoard(
  'open-9x9',
  `
.........
.........
.........
.........
....G....
.........
.........
.........
.........
`,
);

// ~17% density — 14 mountains out of 81 tiles.
const SPARSE_MTNS_9x9 = parseBoard(
  'sparse-mtns-9x9',
  `
..M......
.....M...
M........
...M..M..
....G....
.M.....M.
...MM..M.
..M....M.
.....M...
`,
);

// -- 11x11 boards -------------------------------------------------------------

const OPEN_11x11 = parseBoard(
  'open-11x11',
  `
...........
...........
...........
...........
...........
.....G.....
...........
...........
...........
...........
...........
`,
);

// ~17% density — 21 mountains out of 121 tiles.
const SPARSE_MTNS_11x11 = parseBoard(
  'sparse-mtns-11x11',
  `
.M....M....
.....M.....
...M.....M.
......M...M
.M....M....
.....G..M..
..M........
.MM.....M..
.M...M.....
.......M..M
...M..M....
`,
);

// -- File-based boards -------------------------------------------------------

const DATA_DIR = path.join(__dirname, 'test-boards-data');

function loadBoard(filename: string): TestBoard {
  const name = filename.replace(/\.txt$/, '');
  const text = fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8');
  return parseBoard(name, text);
}

const CORNER_7x7 = loadBoard('corner-7x7.txt');

const CORNER_9x9 = loadBoard('corner-9x9.txt');
const DOUBLE_CORRIDOR_9x9 = loadBoard('double-corridor-9x9.txt');
const DENSE_MTNS_9x9 = loadBoard('dense-mtns-9x9.txt');
const MAZE_9x9 = loadBoard('maze-9x9.txt');
const EDGE_9x9 = loadBoard('edge-9x9.txt');
const PINCH_9x9 = loadBoard('pinch-9x9.txt');
const EDGE_POCKET_9x9 = loadBoard('edge-pocket-9x9.txt');
const EDGE_POCKET_2_9x9 = loadBoard('edge-pocket-2-9x9.txt');
const HARD_DEGREE3_9x9 = loadBoard('hard-degree3-9x9.txt');

const CORRIDOR_11x11 = loadBoard('corridor-11x11.txt');
const NARROW_CORRIDORS_11x11 = loadBoard('narrow-corridors-11x11.txt');
const POCKET_11x11 = loadBoard('pocket-11x11.txt');
const CROSS_WALLS_11x11 = loadBoard('cross-walls-11x11.txt');
const ISLAND_11x11 = loadBoard('island-11x11.txt');
const FLOATING_CORNER_11x11 = loadBoard('floating-corner-11x11.txt');

const OPEN_13x13 = loadBoard('open-13x13.txt');
const CORNER_13x13 = loadBoard('corner-13x13.txt');
const SPARSE_MTNS_13x13 = loadBoard('sparse-mtns-13x13.txt');
const OFF_CENTER_13x13 = loadBoard('off-center-13x13.txt');
const SCATTERED_POCKETS_13x13 = loadBoard('scattered-pockets-13x13.txt');

// -- Board registry ----------------------------------------------------------

const ALL_BOARDS: TestBoard[] = [
  OPEN_7x7,
  SPARSE_MTNS_7x7,
  CORRIDOR_7x7,
  MAZE_7x7,
  CORNER_7x7,

  OPEN_9x9,
  SPARSE_MTNS_9x9,
  CORNER_9x9,
  DOUBLE_CORRIDOR_9x9,
  DENSE_MTNS_9x9,
  MAZE_9x9,
  EDGE_9x9,
  PINCH_9x9,
  EDGE_POCKET_9x9,
  EDGE_POCKET_2_9x9,
  HARD_DEGREE3_9x9,

  OPEN_11x11,
  SPARSE_MTNS_11x11,
  CORRIDOR_11x11,
  NARROW_CORRIDORS_11x11,
  POCKET_11x11,
  CROSS_WALLS_11x11,
  ISLAND_11x11,
  FLOATING_CORNER_11x11,

  OPEN_13x13,
  CORNER_13x13,
  SPARSE_MTNS_13x13,
  OFF_CENTER_13x13,
  SCATTERED_POCKETS_13x13,
];

function makeBoard(name: string): TestBoard {
  const board = ALL_BOARDS.find((b) => b.name === name);
  if (!board) throw new Error(`Unknown board: ${name}`);
  return board;
}

function allBoards(): TestBoard[] {
  return ALL_BOARDS;
}

export type { TestBoard };
export { makeBoard, allBoards, parseBoard };

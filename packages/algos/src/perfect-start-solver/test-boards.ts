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

// -- File loading ------------------------------------------------------------

const DATA_DIR = path.join(__dirname, 'test-boards-data');

function loadBoard(filepath: string): TestBoard {
  const name = path.basename(filepath).replace(/\.txt$/, '');
  const text = fs.readFileSync(path.join(DATA_DIR, filepath), 'utf-8');
  return parseBoard(name, text);
}

// -- Simple boards (7x7 through 13x13, hand-crafted) ------------------------

const SIMPLE_BOARDS: TestBoard[] = [
  loadBoard('open-7x7.txt'),
  loadBoard('sparse-mtns-7x7.txt'),
  loadBoard('corridor-7x7.txt'),
  loadBoard('maze-7x7.txt'),
  loadBoard('corner-7x7.txt'),

  loadBoard('open-9x9.txt'),
  loadBoard('sparse-mtns-9x9.txt'),
  loadBoard('corner-9x9.txt'),
  loadBoard('double-corridor-9x9.txt'),
  loadBoard('dense-mtns-9x9.txt'),
  loadBoard('maze-9x9.txt'),
  loadBoard('edge-9x9.txt'),
  loadBoard('pinch-9x9.txt'),
  loadBoard('edge-pocket-9x9.txt'),
  loadBoard('edge-pocket-2-9x9.txt'),
  loadBoard('hard-degree3-9x9.txt'),

  loadBoard('open-11x11.txt'),
  loadBoard('sparse-mtns-11x11.txt'),
  loadBoard('corridor-11x11.txt'),
  loadBoard('narrow-corridors-11x11.txt'),
  loadBoard('pocket-11x11.txt'),
  loadBoard('pocket-2-11x11.txt'),
  loadBoard('cross-walls-11x11.txt'),
  loadBoard('island-11x11.txt'),
  loadBoard('floating-corner-11x11.txt'),

  loadBoard('open-13x13.txt'),
  loadBoard('corner-13x13.txt'),
  loadBoard('sparse-mtns-13x13.txt'),
  loadBoard('off-center-13x13.txt'),
  loadBoard('scattered-pockets-13x13.txt'),
];

// -- Realistic boards (25x25+, generated with terrain-generation) ------------

const REALISTIC_BOARDS: TestBoard[] = [
  loadBoard('25x25/3.21-real-board-edge-choke-point.txt'),
  loadBoard('25x25/3.21-real-board-half-enclosed-half-open.txt'),
  loadBoard('25x25/3.21-real-board-medium-spacious.txt'),
  loadBoard('25x25/3.21-real-board-semi-enclosed-region.txt'),
  loadBoard('25x25/3.21-real-board-tight-corner-1.txt'),
  loadBoard('25x25/3.21-real-board-tight-corner-2.txt'),
  loadBoard('30x30/3.22-fairly-open.txt'),
  loadBoard('30x30/3.22-fairly-open-2.txt'),
  loadBoard('30x30/3.22-semi-open-with-small-pocket.txt'),
  loadBoard('30x30/3.22-nooks-and-crannies.txt'),
  loadBoard('30x30/3-22.edge-1.txt'),
  loadBoard('30x30/3-22.tight-edge-with-chokes.txt'),
  loadBoard('30x30/3.22-big-region-with-tight-choke.txt'),
  loadBoard('30x30/3.22-semi-tight-near-corner.txt'),
  loadBoard('30x30/3.22-small-corner-pocket.txt'),
];

// -- Board registry ----------------------------------------------------------

const ALL_BOARDS: TestBoard[] = [...SIMPLE_BOARDS, ...REALISTIC_BOARDS];

function makeBoard(name: string): TestBoard {
  const board = ALL_BOARDS.find((b) => b.name === name);
  if (!board) throw new Error(`Unknown board: ${name}`);
  return board;
}

// -- Slow boards (>100ms, optimization targets) -----------------------------
// Remove boards from these lists as performance improves.

// Search-bottlenecked: >500ms, dominated by search time.
const SLOW_SEARCH: TestBoard[] = [
  makeBoard('corner-7x7'), // 1866ms — deep search
  makeBoard('corner-9x9'), // 5841ms — deep search
  makeBoard('corner-13x13'), // 7046ms — deep search
  makeBoard('edge-pocket-9x9'), // 1132ms — mixed
  makeBoard('edge-pocket-2-9x9'), // 2212ms — infeasible target
  makeBoard('pocket-11x11'), // 3592ms — infeasible target
  makeBoard('floating-corner-11x11'), // 2938ms — deep search
  makeBoard('scattered-pockets-13x13'), // 3187ms — infeasible target
  makeBoard('3.21-real-board-half-enclosed-half-open'), // 678ms — deep search
  makeBoard('3.21-real-board-tight-corner-1'), // 1076ms — infeasible target
  makeBoard('3.21-real-board-tight-corner-2'), // 6756ms — infeasible target
  makeBoard('3.22-semi-open-with-small-pocket'), // 2083ms — deep search
  makeBoard('3-22.tight-edge-with-chokes'), // 1408ms — infeasible target
];

// Path-gen-bottlenecked: >100ms, dominated by path generation.
const SLOW_PATHGEN: TestBoard[] = [
  makeBoard('open-9x9'), // 128ms — 95% path gen
  makeBoard('open-11x11'), // 225ms — 97% path gen
  makeBoard('open-13x13'), // 293ms — 97% path gen
];

function allBoards(): TestBoard[] {
  return ALL_BOARDS;
}

function simpleBoards(): TestBoard[] {
  return SIMPLE_BOARDS;
}

function realisticBoards(): TestBoard[] {
  return REALISTIC_BOARDS;
}

function slowSearch(): TestBoard[] {
  return SLOW_SEARCH;
}

function slowPathgen(): TestBoard[] {
  return SLOW_PATHGEN;
}

export type { TestBoard };
export {
  makeBoard,
  allBoards,
  simpleBoards,
  realisticBoards,
  slowSearch,
  slowPathgen,
  parseBoard,
};

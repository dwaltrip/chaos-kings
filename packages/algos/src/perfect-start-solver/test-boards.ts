import * as fs from 'fs';
import * as path from 'path';

import { type TestBoard, parseBoard } from './utils/parse-board';

// -- File loading ------------------------------------------------------------

const DATA_DIR = path.join(__dirname, 'test-boards-data');

function loadBoard(filepath: string): TestBoard {
  const name = path.basename(filepath).replace(/\.txt$/, '');
  const text = fs.readFileSync(path.join(DATA_DIR, filepath), 'utf-8');
  return parseBoard(name, text);
}

// -- Simple boards (7x7 through 13x13, hand-crafted) ------------------------

const SIMPLE_BOARDS: TestBoard[] = [
  loadBoard('simple/open-7x7.txt'),
  loadBoard('simple/sparse-mtns-7x7.txt'),
  loadBoard('simple/corridor-7x7.txt'),
  loadBoard('simple/maze-7x7.txt'),
  loadBoard('simple/corner-7x7.txt'),

  loadBoard('simple/open-9x9.txt'),
  loadBoard('simple/sparse-mtns-9x9.txt'),
  loadBoard('simple/corner-9x9.txt'),
  loadBoard('simple/double-corridor-9x9.txt'),
  loadBoard('simple/dense-mtns-9x9.txt'),
  loadBoard('simple/maze-9x9.txt'),
  loadBoard('simple/edge-9x9.txt'),
  loadBoard('simple/pinch-9x9.txt'),
  loadBoard('simple/edge-pocket-9x9.txt'),
  loadBoard('simple/edge-pocket-2-9x9.txt'),
  loadBoard('simple/hard-degree3-9x9.txt'),

  loadBoard('simple/open-11x11.txt'),
  loadBoard('simple/sparse-mtns-11x11.txt'),
  loadBoard('simple/corridor-11x11.txt'),
  loadBoard('simple/narrow-corridors-11x11.txt'),
  loadBoard('simple/pocket-11x11.txt'),
  loadBoard('simple/pocket-2-11x11.txt'),
  loadBoard('simple/cross-walls-11x11.txt'),
  loadBoard('simple/island-11x11.txt'),
  loadBoard('simple/floating-corner-11x11.txt'),

  loadBoard('simple/open-13x13.txt'),
  loadBoard('simple/corner-13x13.txt'),
  loadBoard('simple/sparse-mtns-13x13.txt'),
  loadBoard('simple/off-center-13x13.txt'),
  loadBoard('simple/scattered-pockets-13x13.txt'),
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

// Search-bottlenecked: >100ms with heavy search. Updated session 3.22-5.
const SLOW_SEARCH: TestBoard[] = [
  makeBoard('corner-7x7'),
  makeBoard('corner-9x9'),
  makeBoard('corner-13x13'),
  // trivial board — should solve fast, 120K candidates is suspicious
  makeBoard('edge-9x9'),
  makeBoard('edge-pocket-9x9'),
  makeBoard('edge-pocket-2-9x9'),
  makeBoard('pocket-11x11'),
  makeBoard('pocket-2-11x11'),
  makeBoard('floating-corner-11x11'),
  makeBoard('scattered-pockets-13x13'),
  makeBoard('3.21-real-board-tight-corner-1'),
  makeBoard('3.21-real-board-tight-corner-2'),
  makeBoard('3.22-semi-open-with-small-pocket'),
  makeBoard('3-22.tight-edge-with-chokes'),
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

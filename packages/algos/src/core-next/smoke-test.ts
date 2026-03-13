// Smoke test: run identical move sequences through both old (core) and new (core-next)
// processStep implementations and compare resulting board state tile-by-tile.

import type { BoardState } from '@core/types';
import { Direction } from '@core/types';
import { processStep as oldProcessStep, createGameState } from '@core/step-processor';
import { DEFAULT_TIMING } from '@core/game-timing-config';
import type { MoveEvent } from '@core/replay/types';

import { Board } from './flat-board';
import type { FlatBoard } from './flat-board';
import { processStep as newProcessStep } from './process-step';
import type { FlatMove } from './process-step';
import { fromBoardState, toBoardState } from './convert';
import { parseBoard } from '../perfect-start-solver/prototyping/test-boards';

const timing = DEFAULT_TIMING;

// --- Helpers ---

function oldMoveEvent(
  src: { x: number; y: number },
  dir: Direction,
  tick: number,
): MoveEvent {
  return { step: tick, playerIndex: 0, sourceCoord: src, direction: dir };
}

function compareBoardStates(
  label: string,
  oldBoard: BoardState,
  flatBoard: FlatBoard,
): boolean {
  const { width, height } = oldBoard.size;
  let pass = true;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldSq = oldBoard.grid[y][x];
      const tile = Board.getTile(flatBoard, x, y);

      // Compare type (string vs number)
      const oldType = oldSq.type;
      const newTile = Board.getTileByIdx(flatBoard, idx);

      // Convert old type string to check against tile
      const converted = toBoardState(flatBoard);
      const convSq = converted.grid[y][x];

      if (oldSq.type !== convSq.type) {
        console.log(
          `  FAIL [${label}] (${x},${y}) type: old=${oldSq.type} new=${convSq.type}`,
        );
        pass = false;
      }

      if ('units' in oldSq && 'units' in convSq) {
        if (oldSq.units !== convSq.units) {
          console.log(
            `  FAIL [${label}] (${x},${y}) units: old=${oldSq.units} new=${convSq.units}`,
          );
          pass = false;
        }
      }

      if ('playerIndex' in oldSq && 'playerIndex' in convSq) {
        if (oldSq.playerIndex !== convSq.playerIndex) {
          console.log(
            `  FAIL [${label}] (${x},${y}) owner: old=${oldSq.playerIndex} new=${convSq.playerIndex}`,
          );
          pass = false;
        }
      }
    }
  }

  // Compare player stats
  const oldStats = oldGameState.players;
  const newLand = flatBoard.stats.landCounts;
  const newArmy = flatBoard.stats.armyCounts;

  for (let p = 0; p < oldStats.length; p++) {
    if (oldStats[p].landCount !== newLand[p]) {
      console.log(
        `  FAIL [${label}] player ${p} landCount: old=${oldStats[p].landCount} new=${newLand[p]}`,
      );
      pass = false;
    }
    if (oldStats[p].armyCount !== newArmy[p]) {
      console.log(
        `  FAIL [${label}] player ${p} armyCount: old=${oldStats[p].armyCount} new=${newArmy[p]}`,
      );
      pass = false;
    }
  }

  return pass;
}

// --- Test runner ---

interface MoveStep {
  src: { x: number; y: number };
  dir: Direction;
}

function runTest(name: string, boardText: string, moves: (MoveStep | null)[]) {
  const testBoard = parseBoard(name, boardText);

  // Old path
  const oldGameState = createGameState(structuredClone(testBoard.board), 1);

  // New path
  const flatBoard = fromBoardState(structuredClone(testBoard.board), 1);

  let allPass = true;

  for (let i = 0; i < moves.length; i++) {
    const tick = i + 1;
    const move = moves[i];

    // Old
    const events: MoveEvent[] = [];
    if (move) {
      events.push(oldMoveEvent(move.src, move.dir, tick));
    }
    oldProcessStep(oldGameState, events, timing);

    // New
    const flatMove: FlatMove = move
      ? { src: move.src.y * flatBoard.width + move.src.x, dir: move.dir }
      : null;
    newProcessStep(flatBoard, flatMove, 0, tick, timing);

    // Compare
    const label = `tick ${tick}`;
    const converted = toBoardState(flatBoard);

    const { width, height } = oldGameState.board.size;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const oldSq = oldGameState.board.grid[y][x];
        const newSq = converted.grid[y][x];

        if (oldSq.type !== newSq.type) {
          console.log(
            `  FAIL [${label}] (${x},${y}) type: old=${oldSq.type} new=${newSq.type}`,
          );
          allPass = false;
        }
        if ('units' in oldSq && 'units' in newSq) {
          if (oldSq.units !== newSq.units) {
            console.log(
              `  FAIL [${label}] (${x},${y}) units: old=${oldSq.units} new=${newSq.units}`,
            );
            allPass = false;
          }
        }
        if ('playerIndex' in oldSq && 'playerIndex' in newSq) {
          if (oldSq.playerIndex !== newSq.playerIndex) {
            console.log(
              `  FAIL [${label}] (${x},${y}) owner: old=${oldSq.playerIndex} new=${newSq.playerIndex}`,
            );
            allPass = false;
          }
        }
      }
    }

    // Stats
    for (let p = 0; p < oldGameState.players.length; p++) {
      if (oldGameState.players[p].landCount !== flatBoard.stats.landCounts[p]) {
        console.log(
          `  FAIL [${label}] player ${p} land: old=${oldGameState.players[p].landCount} new=${flatBoard.stats.landCounts[p]}`,
        );
        allPass = false;
      }
      if (oldGameState.players[p].armyCount !== flatBoard.stats.armyCounts[p]) {
        console.log(
          `  FAIL [${label}] player ${p} army: old=${oldGameState.players[p].armyCount} new=${flatBoard.stats.armyCounts[p]}`,
        );
        allPass = false;
      }
    }
  }

  console.log(`${allPass ? 'PASS' : 'FAIL'}: ${name}`);
  return allPass;
}

// --- Tests ---

const D = Direction;

// Test 1: Just wait (no moves) — tests production only
runTest(
  'production-only (10 ticks)',
  `
...
.G.
...
`,
  [null, null, null, null, null, null, null, null, null, null],
);

// Test 2: Move right then down — tests blank capture
runTest(
  'move-right-then-down',
  `
...
.G.
...
`,
  [
    null, // tick 1: wait (general has 1 unit, can't move yet)
    { src: { x: 1, y: 1 }, dir: D.RIGHT }, // tick 2: general got +1 from production, now 2, move right
    null, // tick 3: wait
    { src: { x: 1, y: 1 }, dir: D.DOWN }, // tick 4
  ],
);

// Test 3: Move into mountain (should be rejected)
runTest(
  'blocked-by-mountain',
  `
.M.
.G.
...
`,
  [
    null, // tick 1
    { src: { x: 1, y: 1 }, dir: D.UP }, // tick 2: blocked by mountain
  ],
);

// Test 4: Chain expansion
runTest(
  'chain-expansion',
  `
.....
..G..
.....
`,
  [
    null, // tick 1: wait for production
    { src: { x: 2, y: 1 }, dir: D.RIGHT }, // tick 2
    null, // tick 3
    { src: { x: 2, y: 1 }, dir: D.LEFT }, // tick 4
    null, // tick 5
    { src: { x: 2, y: 1 }, dir: D.UP }, // tick 6
    null, // tick 7
    { src: { x: 2, y: 1 }, dir: D.DOWN }, // tick 8
  ],
);

// Test 5: Friendly merge
runTest(
  'friendly-merge',
  `
.....
..G..
.....
`,
  [
    null, // tick 1
    { src: { x: 2, y: 1 }, dir: D.RIGHT }, // tick 2: capture (2,1)->(3,1)
    null, // tick 3
    null, // tick 4
    { src: { x: 2, y: 1 }, dir: D.RIGHT }, // tick 5: merge into friendly (3,1)
  ],
);

// Test 6: Many ticks with production cycles (test land production at tick 25)
const manyWaits = new Array(30).fill(null);
runTest('30-ticks-production', `\n...\n.G.\n...\n`, manyWaits);

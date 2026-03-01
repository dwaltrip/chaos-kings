/**
 * Generates game state snapshots for the Game UI Lab page.
 * Run: npx tsx tools/generate-ui-lab-data.ts
 */
import * as fs from 'fs';
import * as path from 'path';

import { generateGameMapV2 } from '@core/terrain-generation/game-map-generator';
import { createGameState, processStep } from '@core/step-processor';
import { deepCloneGameState } from '@core/utils/clone-utils';
import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import { validateMove } from '@core/moves/validate-move';
import { DEFAULT_TIMING } from '@core/game-timing-config';
import type {
  GameState,
  BoardState,
  Coord,
  Direction,
  Movement,
  Size2d,
} from '@core/types';
import { Direction as Dir } from '@core/types';
import type { MoveEvent } from '@core/replay/types';

// ---- Config ----

const SEED = 42;
const BOARD_SIZE: Size2d = { width: 18, height: 18 };
const NUM_PLAYERS = 1;
const TOTAL_TICKS = 80;

const DATA_DIR = path.resolve(__dirname, '../apps/frontend/src/domains/game-ui-lab/data');

// ---- Types ----

// Board states keyed by tick number (large, changes only on ticks)
interface LabBoardStates {
  [tick: string]: BoardState;
}

// UI frames (small, includes queuing frames between ticks)
interface LabFrame {
  tick: number;
  queuedMoves: Movement[];
  selectedTile: Coord | null;
}

interface LabFrameData {
  frames: LabFrame[];
  playerIndex: number;
  config: { size: Size2d; numPlayers: number };
}

// ---- Move generation ----

const ALL_DIRS: Direction[] = [Dir.UP, Dir.DOWN, Dir.LEFT, Dir.RIGHT];

// Find border tiles — player tiles adjacent to non-player tiles
function findBorderTiles(board: BoardState, playerIndex: number): Coord[] {
  const borders: Coord[] = [];
  for (const sq of Board.iterPlayerSquares(board, playerIndex)) {
    for (const dir of ALL_DIRS) {
      if (!Board.canMove(board, sq.coord, dir)) continue;
      const dest = Board.getSquare(board, sq.coord, dir);
      if (!isPlayerSquare(dest) || dest.playerIndex !== playerIndex) {
        borders.push(sq.coord);
        break;
      }
    }
  }
  return borders;
}

// Find valid expansion moves from a coord (toward unowned tiles)
function findExpansionMoves(
  board: BoardState,
  coord: Coord,
  playerIndex: number,
): Direction[] {
  const dirs: Direction[] = [];
  for (const dir of ALL_DIRS) {
    const result = validateMove(board, playerIndex, coord, dir);
    if (!result.ok) continue;
    const dest = Board.getSquare(board, coord, dir);
    if (!isPlayerSquare(dest) || dest.playerIndex !== playerIndex) {
      dirs.push(dir);
    }
  }
  return dirs;
}

// Simple seeded RNG
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Plan a chain of moves in a sustained direction from a starting coord.
// Simulates on a cloned state to verify the full chain is valid.
// Moves through owned territory and into unowned territory.
function planMoveChain(
  gameState: GameState,
  startCoord: Coord,
  primaryDir: Direction,
  playerIndex: number,
  maxLength: number,
): Movement[] {
  const chain: Movement[] = [];
  const state = deepCloneGameState(gameState);
  let currentCoord = startCoord;

  for (let i = 0; i < maxLength; i++) {
    const result = validateMove(state.board, playerIndex, currentCoord, primaryDir);
    if (!result.ok) break;

    chain.push({ sourceCoord: { ...currentCoord }, direction: primaryDir });

    const event: MoveEvent = {
      step: state.tick + 1,
      playerIndex,
      sourceCoord: currentCoord,
      direction: primaryDir,
    };
    processStep(state, [event], DEFAULT_TIMING);
    currentCoord = Board.applyDirection(currentCoord, primaryDir);
  }

  return chain;
}

// Score a direction by how far we can go, with bonus for reaching unowned tiles
function scoreMoveChain(
  gameState: GameState,
  startCoord: Coord,
  dir: Direction,
  playerIndex: number,
): number {
  const chain = planMoveChain(gameState, startCoord, dir, playerIndex, 10);
  if (chain.length === 0) return 0;

  let score = chain.length;
  // Bonus: count how many tiles in the chain are unowned (real expansion)
  let coord = startCoord;
  for (const move of chain) {
    coord = Board.applyDirection(move.sourceCoord, move.direction);
    const sq = Board.getSquare(gameState.board, coord);
    if (!isPlayerSquare(sq) || sq.playerIndex !== playerIndex) {
      score += 2;
    }
  }
  return score;
}

// Find the best direction to move from a high-unit tile.
// Works even if the tile is interior — chain moves through owned territory
// toward the border and beyond.
function findBestMoveDir(
  gameState: GameState,
  coord: Coord,
  playerIndex: number,
  rng: () => number,
): Direction | null {
  const scored = ALL_DIRS.map((dir) => ({
    dir,
    score: scoreMoveChain(gameState, coord, dir, playerIndex),
  })).filter((s) => s.score > 0);

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  // Pick from top directions with some randomness
  const best = scored.filter((s) => s.score >= scored[0].score - 2);
  return pickRandom(best, rng).dir;
}

// ---- Main ----

const MIN_UNITS_TO_MOVE = 5;

function main() {
  const rng = makeRng(SEED + 9999);

  const { grid } = generateGameMapV2({
    size: BOARD_SIZE,
    numPlayers: NUM_PLAYERS,
    minGeneralDistance: 8,
    seed: SEED,
  });

  const board: BoardState = { grid, size: BOARD_SIZE };
  const gameState = createGameState(board, NUM_PLAYERS);

  const boardStates: LabBoardStates = {};
  const frames: LabFrame[] = [];

  let moveQueue: MoveEvent[] = [];

  // Tick 0
  boardStates[0] = deepCloneGameState(gameState).board;
  frames.push({ tick: 0, queuedMoves: [], selectedTile: null });

  for (let i = 0; i < TOTAL_TICKS; i++) {
    // If no moves queued, check if we have enough troops to plan a burst.
    // Before executing the first move, emit "queuing" frames that show
    // the player adding moves one by one (board doesn't change yet).
    if (moveQueue.length === 0) {
      const general = [...Board.iterPlayerSquares(gameState.board, 0)].sort(
        (a, b) => b.units - a.units,
      )[0];

      if (general && general.units >= MIN_UNITS_TO_MOVE) {
        const dir = findBestMoveDir(gameState, general.coord, 0, rng);
        if (dir) {
          const chainLength = Math.min(general.units - 1, 3 + Math.floor(rng() * 5));
          const chain = planMoveChain(gameState, general.coord, dir, 0, chainLength);
          moveQueue = chain.map((m, idx) => ({
            step: gameState.tick + 1 + idx,
            playerIndex: 0,
            sourceCoord: m.sourceCoord,
            direction: m.direction,
          }));

          // Frame: player selects the general (before any queuing)
          frames.push({
            tick: gameState.tick,
            queuedMoves: [],
            selectedTile: { ...general.coord },
          });

          // Frames: each move gets added to the queue
          let selectedCoord = general.coord;
          for (let j = 0; j < chain.length; j++) {
            selectedCoord = Board.applyDirection(
              chain[j].sourceCoord,
              chain[j].direction,
            );
            frames.push({
              tick: gameState.tick,
              queuedMoves: chain.slice(0, j + 1),
              selectedTile: { ...selectedCoord },
            });
          }
        }
      }
    }

    // Execute next move from queue (if any)
    const nextMove = moveQueue.shift() ?? null;
    const events = nextMove ? [nextMove] : [];
    processStep(gameState, events, DEFAULT_TIMING);

    // Store this tick's board state
    boardStates[gameState.tick] = deepCloneGameState(gameState).board;

    // Selected tile: destination of the move that just executed,
    // or the source of the next queued move, or null between bursts
    let selectedTile: Coord | null = null;
    if (nextMove) {
      selectedTile = Board.applyDirection(nextMove.sourceCoord, nextMove.direction);
    } else if (moveQueue.length > 0) {
      selectedTile = moveQueue[0].sourceCoord;
    }

    const queuedMoves: Movement[] = moveQueue.map((m) => ({
      sourceCoord: m.sourceCoord,
      direction: m.direction,
    }));

    frames.push({ tick: gameState.tick, queuedMoves, selectedTile });
  }

  const frameData: LabFrameData = {
    frames,
    playerIndex: 0,
    config: { size: BOARD_SIZE, numPlayers: NUM_PLAYERS },
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, 'lab-board-states.json'),
    JSON.stringify(boardStates, null, 2),
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'lab-frames.json'),
    JSON.stringify(frameData, null, 2),
  );

  console.log(
    `Generated ${frames.length} frames, ${Object.keys(boardStates).length} board states`,
  );
  console.log(
    `Board: ${BOARD_SIZE.width}x${BOARD_SIZE.height}, ${NUM_PLAYERS} player(s)`,
  );

  const withQueue = frames.filter((f) => f.queuedMoves.length > 0);
  const maxQueue = Math.max(...frames.map((f) => f.queuedMoves.length));
  console.log(
    `Frames with queued moves: ${withQueue.length}, max queue size: ${maxQueue}`,
  );
}

main();

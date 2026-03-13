import { Direction } from '@core/types';
import type { TimingConfig } from '@core/timing/types';

import { TileType, NO_OWNER, Board } from './flat-board';
import type { FlatBoard } from './flat-board';

// --- Move types ---

type FlatMove = {
  src: number;
  dir: Direction;
} | null;

interface MoveResult {
  capture?: {
    defeated: number;
    capturedBy: number;
  };
}

// --- Validation ---

interface MoveValidation {
  ok: boolean;
  destIdx: number;
}

function validateMove(
  board: FlatBoard,
  playerIndex: number,
  src: number,
  dir: Direction,
): MoveValidation {
  const fail: MoveValidation = { ok: false, destIdx: -1 };

  if (board.owners[src] !== playerIndex) return fail;
  if (board.units[src] <= 1) return fail;

  const destIdx = Board.neighbor(board, src, dir);
  if (destIdx === -1) return fail;
  if (board.types[destIdx] === TileType.MOUNTAIN) return fail;

  return { ok: true, destIdx };
}

// --- Apply move ---

function applyMove(
  board: FlatBoard,
  playerIndex: number,
  src: number,
  destIdx: number,
): MoveResult {
  const srcUnits = board.units[src];
  const destType = board.types[destIdx] as number;
  const destOwner = board.owners[destIdx];
  const movingUnits = srcUnits - 1;

  // Source always leaves 1 unit behind
  board.units[src] = 1;
  // armyCount adjustment for source: lost (movingUnits) units
  board.stats.armyCounts[playerIndex] -= movingUnits;

  // Case 1: Blank
  if (destType === TileType.BLANK) {
    board.types[destIdx] = TileType.ARMY;
    board.owners[destIdx] = playerIndex;
    board.units[destIdx] = movingUnits;
    board.stats.landCounts[playerIndex]++;
    board.stats.armyCounts[playerIndex] += movingUnits;
    return {};
  }

  // Case 2: Friendly
  if (destOwner === playerIndex) {
    board.units[destIdx] += movingUnits;
    board.stats.armyCounts[playerIndex] += movingUnits;
    return {};
  }

  // Cases 3+: Enemy
  const destUnits = board.units[destIdx];

  // Case 3: Enemy defends (defender wins ties)
  if (movingUnits <= destUnits) {
    board.units[destIdx] = destUnits - movingUnits;
    board.stats.armyCounts[destOwner] -= movingUnits;
    return {};
  }

  // Attacker wins — surviving units
  const survivingUnits = movingUnits - destUnits;

  // Remove all defender units from stats
  board.stats.armyCounts[destOwner] -= destUnits;

  // Case 4: Enemy general captured
  if (destType === TileType.GENERAL) {
    const defeatedPlayer = destOwner;

    // Convert general to player city, transfer ownership
    board.types[destIdx] = TileType.PLAYER_CITY;
    board.owners[destIdx] = playerIndex;
    board.units[destIdx] = survivingUnits;
    board.stats.landCounts[defeatedPlayer]--;
    board.stats.landCounts[playerIndex]++;
    board.stats.armyCounts[playerIndex] += survivingUnits;

    // Transfer all defeated player's remaining tiles
    const n = board.width * board.height;
    for (let i = 0; i < n; i++) {
      if (board.owners[i] === defeatedPlayer) {
        board.owners[i] = playerIndex;
        const oldUnits = board.units[i];
        const newUnits = Math.max(1, Math.floor(oldUnits / 2));
        board.units[i] = newUnits;

        board.stats.landCounts[defeatedPlayer]--;
        board.stats.landCounts[playerIndex]++;
        board.stats.armyCounts[defeatedPlayer] -= oldUnits;
        board.stats.armyCounts[playerIndex] += newUnits;
      }
    }

    return {
      capture: { defeated: defeatedPlayer, capturedBy: playerIndex },
    };
  }

  // Case 5: Regular enemy tile captured
  board.owners[destIdx] = playerIndex;
  board.units[destIdx] = survivingUnits;
  board.stats.landCounts[destOwner]--;
  board.stats.landCounts[playerIndex]++;
  board.stats.armyCounts[playerIndex] += survivingUnits;
  return {};
}

// --- Production ---

function applyProduction(board: FlatBoard, tick: number, timing: TimingConfig): void {
  const n = board.width * board.height;

  if (tick % timing.generalProductionTicks === 0) {
    for (let i = 0; i < n; i++) {
      const t = board.types[i];
      if (t === TileType.GENERAL || t === TileType.PLAYER_CITY) {
        board.units[i]++;
        const owner = board.owners[i];
        board.stats.armyCounts[owner]++;
      }
    }
  }

  if (tick % timing.landProductionTicks === 0) {
    for (let i = 0; i < n; i++) {
      if (board.owners[i] !== NO_OWNER) {
        board.units[i]++;
        const owner = board.owners[i];
        board.stats.armyCounts[owner]++;
      }
    }
  }
}

// --- processStep ---

function processStep(
  board: FlatBoard,
  move: FlatMove,
  playerIndex: number,
  tick: number,
  timing: TimingConfig,
): MoveResult {
  let result: MoveResult = {};

  if (move) {
    const v = validateMove(board, playerIndex, move.src, move.dir);
    if (v.ok) {
      result = applyMove(board, playerIndex, move.src, v.destIdx);
    }
  }

  applyProduction(board, tick, timing);
  return result;
}

export type { FlatMove, MoveResult };
export { processStep, applyMove, applyProduction, validateMove };

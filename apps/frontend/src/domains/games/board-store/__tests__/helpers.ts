import { Direction, SquareType } from '@core/types';
import type { BoardState, Coord, Movement } from '@core/types';

import { createBoardStore } from '../board-store';
import * as rawActions from '../actions';
import type { TileData } from '../types';

type SquareOverride =
  | { type: 'ARMY' | 'GENERAL' | 'PLAYER_CITY'; playerIndex: number; units: number }
  | { type: 'MOUNTAIN' | 'BLANK' | 'NEUTRAL_CITY' };

function createTestBoard(
  width: number,
  height: number,
  overrides: Record<string, SquareOverride> = {},
): BoardState {
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const key = `${x},${y}`;
      const override = overrides[key];
      if (override) {
        if (
          override.type === 'ARMY' ||
          override.type === 'GENERAL' ||
          override.type === 'PLAYER_CITY'
        ) {
          return {
            coord: { x, y },
            type: override.type,
            playerIndex: override.playerIndex,
            units: override.units,
          };
        }
        return { coord: { x, y }, type: override.type };
      }
      return { coord: { x, y }, type: SquareType.BLANK };
    }),
  );
  return { grid, size: { width, height } };
}

// 3x3 board: player army at (1,1), enemy general at (0,0), mountain at (2,1)
function standardBoard(): BoardState {
  return createTestBoard(3, 3, {
    '1,1': { type: 'ARMY', playerIndex: 0, units: 5 },
    '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
    '2,1': { type: 'MOUNTAIN' },
  });
}

// Like standardBoard but with a different army count at (1,1)
function modifiedStandardBoard(armyUnits = 99): BoardState {
  return createTestBoard(3, 3, {
    '1,1': { type: 'ARMY', playerIndex: 0, units: armyUnits },
    '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
    '2,1': { type: 'MOUNTAIN' },
  });
}

// 5x5 board: player at (0,0), enemy at (4,4) — most tiles in fog
function fogBoard(): BoardState {
  return createTestBoard(5, 5, {
    '0,0': { type: 'ARMY', playerIndex: 0, units: 5 },
    '4,4': { type: 'ARMY', playerIndex: 1, units: 3 },
  });
}

function setup() {
  const store = createBoardStore();
  return {
    store,
    initBoard: store.makeAction(rawActions.initBoard),
    applyTick: store.makeAction(rawActions.applyTick),
    setSelectedTile: store.makeAction(rawActions.setSelectedTile),
    userSelectTile: store.makeAction(rawActions.userSelectTile),
    setStatus: store.makeAction(rawActions.setStatus),
    undoLastQueuedMove: store.makeAction(rawActions.undoLastQueuedMove),
    queueMoveOnBoard: store.makeAction(rawActions.queueMoveOnBoard),
    cancelQueuedMoves: store.makeAction(rawActions.cancelQueuedMoves),
  };
}

function setupStandard() {
  const ctx = setup();
  ctx.initBoard([], 0, standardBoard());
  return ctx;
}

function setupFog() {
  const ctx = setup();
  ctx.initBoard([], 0, fogBoard());
  return ctx;
}

function makeMove(source: Coord, direction: Direction): Movement {
  return { sourceCoord: source, direction };
}

function tileAt(
  store: ReturnType<typeof createBoardStore>,
  x: number,
  y: number,
): TileData {
  return store.getTileData({ x, y });
}

function makeTileData(overrides: Partial<TileData> = {}): TileData {
  return {
    coord: { x: 0, y: 0 },
    type: SquareType.BLANK,
    playerIndex: -1,
    armyCount: 0,
    isVisible: false,
    neighborVisTop: false,
    neighborVisLeft: false,
    isSelected: false,
    isSelectable: false,
    isValidMove: false,
    hasTopBorder: false,
    hasLeftBorder: false,
    queuedUp: false,
    queuedDown: false,
    queuedLeft: false,
    queuedRight: false,
    ...overrides,
  };
}

export type { SquareOverride };
export {
  createTestBoard,
  standardBoard,
  modifiedStandardBoard,
  fogBoard,
  setup,
  setupStandard,
  setupFog,
  makeMove,
  tileAt,
  makeTileData,
};

import { describe, it, expect, vi } from 'vitest';
import { Direction, SquareType } from '@core/types';
import type { BoardState, Coord, Movement } from '@core/types';

import { createBoardStore } from '../board-store';
import * as rawActions from '../actions';
import { tilesEqual, toTileRendererProps } from '../tile-data';
import type { TileData } from '../types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

function standardBoard(): BoardState {
  return createTestBoard(3, 3, {
    '1,1': { type: 'ARMY', playerIndex: 0, units: 5 },
    '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
    '2,1': { type: 'MOUNTAIN' },
  });
}

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
    setStatus: store.makeAction(rawActions.setStatus),
    addQueuedMove: store.makeAction(rawActions.addQueuedMove),
    undoLastQueuedMove: store.makeAction(rawActions.undoLastQueuedMove),
    setQueuedMoves: store.makeAction(rawActions.setQueuedMoves),
  };
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

// ---------------------------------------------------------------------------
// Group 1: Pure functions (tilesEqual, toTileRendererProps)
// ---------------------------------------------------------------------------

describe('tilesEqual', () => {
  it('returns true for identical tile data', () => {
    const a = makeTileData();
    const b = makeTileData();
    expect(tilesEqual(a, b)).toBe(true);
  });

  it('returns false when any field differs', () => {
    const a = makeTileData({ armyCount: 5 });
    const b = makeTileData({ armyCount: 10 });
    expect(tilesEqual(a, b)).toBe(false);

    const c = makeTileData({ queuedUp: true });
    const d = makeTileData({ queuedUp: false });
    expect(tilesEqual(c, d)).toBe(false);
  });
});

describe('toTileRendererProps', () => {
  it('converts player tile correctly', () => {
    const coord = { x: 1, y: 2 };
    const tile = makeTileData({
      coord,
      type: SquareType.ARMY,
      playerIndex: 0,
      armyCount: 5,
      isVisible: true,
      isSelected: true,
      isSelectable: false,
      isValidMove: false,
      hasTopBorder: true,
      hasLeftBorder: false,
    });
    const props = toTileRendererProps(tile);
    expect(props.coord).toBe(coord);
    expect(props.square.type).toBe('ARMY');
    expect(props.square.coord).toBe(coord);
    expect((props.square as any).playerIndex).toBe(0);
    expect((props.square as any).units).toBe(5);
    expect(props.isVisible).toBe(true);
    expect(props.isSelected).toBe(true);
    expect(props.hasTopBorder).toBe(true);
    expect(props.hasLeftBorder).toBe(false);
  });

  it('converts neutral tile correctly', () => {
    const coord = { x: 0, y: 0 };
    const tile = makeTileData({ coord, type: SquareType.BLANK, playerIndex: -1 });
    const props = toTileRendererProps(tile);
    expect(props.square.type).toBe('BLANK');
    expect((props.square as any).playerIndex).toBeUndefined();
    expect((props.square as any).units).toBeUndefined();
    expect(props.queuedDirections).toBeUndefined();
  });

  it('converts queued booleans to Direction set', () => {
    const tile = makeTileData({ queuedRight: true, queuedDown: true });
    const props = toTileRendererProps(tile);
    expect(props.queuedDirections).toBeDefined();
    expect(props.queuedDirections!.has(Direction.RIGHT)).toBe(true);
    expect(props.queuedDirections!.has(Direction.DOWN)).toBe(true);
    expect(props.queuedDirections!.has(Direction.UP)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 2: Init and lifecycle
// ---------------------------------------------------------------------------

describe('BoardStore init and lifecycle', () => {
  it('init with board populates tile cache', () => {
    const { store, initBoard } = setup();
    initBoard([], 0, standardBoard());
    // Verify a computed tile differs from default
    const tile = tileAt(store, 1, 1);
    expect(tile.armyCount).toBe(5);
    expect(tile.type).toBe(SquareType.ARMY);
  });

  it('init without board does not error', () => {
    const { store, initBoard } = setup();
    initBoard([], 0);
    expect(store.state.source.board).toBeNull();
  });

  it('init sets source state', () => {
    const { store, initBoard } = setup();
    const players = [{ player_index: 0 }] as any[];
    initBoard(players, 1, standardBoard());
    expect(store.state.source.board!.size.width).toBe(3);
    expect(store.state.source.board!.size.height).toBe(3);
    expect(store.state.source.currentPlayerIndex).toBe(1);
    expect(store.state.source.players).toBe(players);
  });

  it('init called twice without reset uses second board', () => {
    const { store, initBoard } = setup();
    initBoard([], 0, standardBoard());
    const smallBoard = createTestBoard(2, 2);
    initBoard([], 0, smallBoard);
    expect(store.state.source.board!.size.width).toBe(2);
    expect(store.state.source.board!.size.height).toBe(2);
  });

  it('reset clears all state to defaults', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());
    setSelectedTile({ x: 1, y: 1 });
    store.reset();
    expect(store.state.source.board).toBeNull();
    expect(store.state.ui.selectedTile).toBeNull();
  });

  it('reset clears tile subscribers but keeps board subscribers', () => {
    const { store, initBoard, applyTick } = setup();
    initBoard([], 0, standardBoard());

    const tileCb = vi.fn();
    const boardCb = vi.fn();
    store.subscribeTile({ x: 1, y: 1 }, tileCb);
    store.subscribe(boardCb);

    store.reset();
    // Board subscriber fires on reset
    expect(boardCb).toHaveBeenCalledTimes(1);

    // After reset, init again and change (1,1)
    initBoard([], 0, standardBoard());
    const newBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    applyTick(1, newBoard, [], []);

    // Tile subscriber was cleared by reset — not called
    expect(tileCb).not.toHaveBeenCalled();
    // Board subscriber still active: reset(1) + initBoard(2) + applyTick(3)
    expect(boardCb).toHaveBeenCalledTimes(3);
  });

  it('applyTick before initBoard sets state without error', () => {
    const { store, applyTick } = setup();
    applyTick(1, standardBoard(), [], []);
    expect(store.state.source.tick).toBe(1);
    expect(store.state.source.board).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Group 3: Tile computation (through BoardStore)
// ---------------------------------------------------------------------------

describe('Tile computation', () => {
  it('blank tile in fog has correct defaults', () => {
    const { store, initBoard } = setup();
    initBoard([], 0, fogBoard());
    // (4,3) is far from player at (0,0) — in fog
    const tile = tileAt(store, 4, 3);
    expect(tile.isVisible).toBe(false);
    expect(tile.isSelected).toBe(false);
    expect(tile.isSelectable).toBe(false);
    expect(tile.isValidMove).toBe(false);
    expect(tile.playerIndex).toBe(-1);
    expect(tile.armyCount).toBe(0);
  });

  it('owned tile is visible and has correct army data', () => {
    const { store, initBoard } = setup();
    initBoard([], 0, standardBoard());
    const tile = tileAt(store, 1, 1);
    expect(tile.isVisible).toBe(true);
    expect(tile.playerIndex).toBe(0);
    expect(tile.armyCount).toBe(5);
    expect(tile.type).toBe(SquareType.ARMY);
  });

  it('isSelectable true for unselected player tile in active game', () => {
    const { store, initBoard } = setup();
    initBoard([], 0, standardBoard());
    const tile = tileAt(store, 1, 1);
    expect(tile.isSelectable).toBe(true);
  });

  it('isSelectable false for neutral tile', () => {
    const { store, initBoard } = setup();
    initBoard([], 0, standardBoard());
    const tile = tileAt(store, 1, 0);
    expect(tile.isSelectable).toBe(false);
  });

  it('isSelectable false after game ends', () => {
    const { store, initBoard, setStatus } = setup();
    initBoard([], 0, standardBoard());
    setStatus('ended');
    const tile = tileAt(store, 1, 1);
    expect(tile.isSelectable).toBe(false);
  });

  it('selected tile shows isSelected true and isSelectable false', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());
    setSelectedTile({ x: 1, y: 1 });
    const tile = tileAt(store, 1, 1);
    expect(tile.isSelected).toBe(true);
    expect(tile.isSelectable).toBe(false);
  });

  it('tile adjacent to selected non-mountain is a valid move', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());
    setSelectedTile({ x: 1, y: 1 });
    const tile = tileAt(store, 1, 0);
    expect(tile.isValidMove).toBe(true);
  });

  it('mountain adjacent to selected is not a valid move', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());
    setSelectedTile({ x: 1, y: 1 });
    const tile = tileAt(store, 2, 1);
    expect(tile.isValidMove).toBe(false);
  });

  it('tile not adjacent to selected is not a valid move', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());
    setSelectedTile({ x: 1, y: 1 });
    const tile = tileAt(store, 0, 0);
    expect(tile.isValidMove).toBe(false);
  });

  it('border flags: visible tile with visible neighbors', () => {
    const { store, initBoard } = setup();
    initBoard([], 0, standardBoard());
    const tile = tileAt(store, 1, 1);
    expect(tile.hasTopBorder).toBe(true);
    expect(tile.hasLeftBorder).toBe(true);
  });

  it('border flags: fog tile with no visible neighbors has borders false', () => {
    const { store, initBoard } = setup();
    initBoard([], 0, fogBoard());
    const tile = tileAt(store, 4, 4);
    expect(tile.hasTopBorder).toBe(false);
    expect(tile.hasLeftBorder).toBe(false);
  });

  it('neighbor visibility flags from adjacent visible tiles', () => {
    const { store, initBoard } = setup();
    initBoard([], 0, fogBoard());
    const tile = tileAt(store, 0, 2);
    expect(tile.isVisible).toBe(false);
    expect(tile.neighborVisTop).toBe(true);
    expect(tile.neighborVisLeft).toBe(false);
    expect(tile.hasTopBorder).toBe(true);
    expect(tile.hasLeftBorder).toBe(false);
  });

  it('all tiles visible when game ended', () => {
    const { store, initBoard, setStatus } = setup();
    initBoard([], 0, fogBoard());
    setStatus('ended');
    const tile = tileAt(store, 4, 4);
    expect(tile.isVisible).toBe(true);
  });

  it('all tiles visible when currentPlayerIndex is null', () => {
    const { store, initBoard } = setup();
    initBoard([], null, fogBoard());
    const tile = tileAt(store, 4, 4);
    expect(tile.isVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 4: State mutations and diffing
// ---------------------------------------------------------------------------

describe('State mutations and diffing', () => {
  it('applyTick with changed army count updates affected tile', () => {
    const { store, initBoard, applyTick } = setup();
    initBoard([], 0, standardBoard());
    const refBefore = store.getTileData({ x: 0, y: 0 });

    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 10 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    applyTick(1, modifiedBoard, [], []);

    // Changed tile has new data
    expect(store.getTileData({ x: 1, y: 1 }).armyCount).toBe(10);
    // Unchanged tile — same reference
    expect(store.getTileData({ x: 0, y: 0 })).toBe(refBefore);
  });

  it('setSelectedTile updates old and new selected tiles', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());

    setSelectedTile({ x: 1, y: 1 });
    expect(store.getTileData({ x: 1, y: 1 }).isSelected).toBe(true);

    setSelectedTile({ x: 0, y: 0 });
    expect(store.getTileData({ x: 1, y: 1 }).isSelected).toBe(false);
    expect(store.getTileData({ x: 0, y: 0 }).isSelected).toBe(true);
  });

  it('setSelectedTile with same coord does not change tile data', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());
    setSelectedTile({ x: 1, y: 1 });

    const refBefore = store.getTileData({ x: 1, y: 1 });
    setSelectedTile({ x: 1, y: 1 });
    const refAfter = store.getTileData({ x: 1, y: 1 });
    expect(refBefore).toBe(refAfter);
  });

  it('setSelectedTile(null) clears selection', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());
    setSelectedTile({ x: 1, y: 1 });
    setSelectedTile(null);
    expect(tileAt(store, 1, 1).isSelected).toBe(false);
  });

  it('addQueuedMove adds direction to tile', () => {
    const { store, initBoard, addQueuedMove } = setup();
    initBoard([], 0, standardBoard());
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    expect(tileAt(store, 1, 1).queuedRight).toBe(true);
  });

  it('multiple queued moves from same tile accumulate', () => {
    const { store, initBoard, addQueuedMove } = setup();
    initBoard([], 0, standardBoard());
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.DOWN));
    const tile = tileAt(store, 1, 1);
    expect(tile.queuedRight).toBe(true);
    expect(tile.queuedDown).toBe(true);
  });

  it('undoLastQueuedMove removes last move', () => {
    const { store, initBoard, addQueuedMove, undoLastQueuedMove } = setup();
    initBoard([], 0, standardBoard());
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.DOWN));
    undoLastQueuedMove();
    const tile = tileAt(store, 1, 1);
    expect(tile.queuedRight).toBe(true);
    expect(tile.queuedDown).toBe(false);
  });

  it('setQueuedMoves replaces all queued moves', () => {
    const { store, initBoard, addQueuedMove, setQueuedMoves } = setup();
    initBoard([], 0, standardBoard());
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.DOWN));

    setQueuedMoves([makeMove({ x: 1, y: 1 }, Direction.UP)]);
    const tile = tileAt(store, 1, 1);
    expect(tile.queuedUp).toBe(true);
    expect(tile.queuedRight).toBe(false);
    expect(tile.queuedDown).toBe(false);
  });

  it('setStatus to ended makes all tiles visible and non-selectable', () => {
    const { store, initBoard, setStatus } = setup();
    initBoard([], 0, standardBoard());
    setStatus('ended');
    expect(tileAt(store, 1, 1).isVisible).toBe(true);
    expect(tileAt(store, 1, 1).isSelectable).toBe(false);

    // Also verify with fog board
    const { store: fogStore, initBoard: fogInit, setStatus: fogSetStatus } = setup();
    fogInit([], 0, fogBoard());
    fogSetStatus('ended');
    expect(tileAt(fogStore, 4, 4).isVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 5: Subscriptions and snapshot stability
// ---------------------------------------------------------------------------

describe('Subscriptions and snapshot stability', () => {
  it('tile subscriber fires only for changed tiles', () => {
    const { store, initBoard, applyTick } = setup();
    initBoard([], 0, standardBoard());

    const cb11 = vi.fn();
    const cb00 = vi.fn();
    store.subscribeTile({ x: 1, y: 1 }, cb11);
    store.subscribeTile({ x: 0, y: 0 }, cb00);

    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    applyTick(1, modifiedBoard, [], []);

    expect(cb11).toHaveBeenCalled();
    expect(cb00).not.toHaveBeenCalled();
  });

  it('tile subscriber does NOT fire when tile data unchanged', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());

    const cb = vi.fn();
    // Subscribe to a tile far from any selection changes
    store.subscribeTile({ x: 2, y: 2 }, cb);

    // setSelectedTile only affects (1,1) and adjacent tiles
    setSelectedTile({ x: 1, y: 1 });
    // (2,2) is not adjacent to (1,1), so its tile data is unchanged
    expect(cb).not.toHaveBeenCalled();
  });

  it('no-op action: tile subscribers silent, board subscriber still fires', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());
    setSelectedTile({ x: 1, y: 1 });

    const tileCb = vi.fn();
    const boardCb = vi.fn();
    store.subscribeTile({ x: 1, y: 1 }, tileCb);
    store.subscribe(boardCb);

    // Same coord — no tile data changes
    setSelectedTile({ x: 1, y: 1 });

    expect(tileCb).not.toHaveBeenCalled();
    expect(boardCb).toHaveBeenCalledTimes(1);
  });

  it('board subscriber fires on every action', () => {
    const { store, initBoard, setSelectedTile } = setup();
    initBoard([], 0, standardBoard());

    const cb = vi.fn();
    store.subscribe(cb);

    setSelectedTile({ x: 1, y: 1 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe prevents future callbacks', () => {
    const { store, initBoard, applyTick } = setup();
    initBoard([], 0, standardBoard());

    const cb = vi.fn();
    const unsub = store.subscribeTile({ x: 1, y: 1 }, cb);
    unsub();

    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    applyTick(1, modifiedBoard, [], []);

    expect(cb).not.toHaveBeenCalled();
  });

  it('getTileData returns same reference when tile unchanged', () => {
    const { store, initBoard, applyTick } = setup();
    initBoard([], 0, standardBoard());

    const ref1 = tileAt(store, 0, 0);
    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    applyTick(1, modifiedBoard, [], []);
    const ref2 = tileAt(store, 0, 0);

    expect(ref1).toBe(ref2);
  });

  it('getTileData returns new reference when tile changed', () => {
    const { store, initBoard, applyTick } = setup();
    initBoard([], 0, standardBoard());

    const ref1 = tileAt(store, 1, 1);
    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    applyTick(1, modifiedBoard, [], []);
    const ref2 = tileAt(store, 1, 1);

    expect(ref1).not.toBe(ref2);
  });

  it('derived is accessible and correct', () => {
    const { store, initBoard, setStatus } = setup();
    initBoard([], 0, fogBoard());
    expect(store.derived.allVisible).toBe(false);

    setStatus('ended');
    expect(store.derived.allVisible).toBe(true);
  });

  it('reset → re-init full cycle: fresh state and working subscriptions', () => {
    const { store, initBoard, applyTick, setSelectedTile } = setup();
    // Init and mutate
    initBoard([], 0, standardBoard());
    setSelectedTile({ x: 1, y: 1 });
    expect(tileAt(store, 1, 1).isSelected).toBe(true);

    // Reset
    store.reset();
    expect(store.state.source.board).toBeNull();
    expect(store.version).toBe(0);

    // Re-init
    initBoard([], 0, standardBoard());
    expect(tileAt(store, 1, 1).isSelected).toBe(false);
    expect(tileAt(store, 1, 1).armyCount).toBe(5);

    // Subscriptions work after re-init
    const cb = vi.fn();
    store.subscribeTile({ x: 1, y: 1 }, cb);
    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    applyTick(1, modifiedBoard, [], []);
    expect(cb).toHaveBeenCalled();
    expect(tileAt(store, 1, 1).armyCount).toBe(99);
  });

  it('version increments on each action', () => {
    const { store, initBoard, setSelectedTile } = setup();
    const v0 = store.version;
    initBoard([], 0, standardBoard());
    expect(store.version).toBe(v0 + 1);
    setSelectedTile({ x: 1, y: 1 });
    expect(store.version).toBe(v0 + 2);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { Direction, SquareType } from '@core/types';
import type { BoardState, Coord, Movement } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import { BoardStore } from '../board-store';
import { tilesEqual, toTileRendererProps } from '../tile-data';
import type { TileData, FrameDiff } from '../types';

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

interface InitOverrides {
  players?: any[];
  currentPlayerIndex?: number | null;
  board?: BoardState;
}

function initStore(store: BoardStore, overrides: InitOverrides = {}): FrameDiff {
  const players = overrides.players ?? [];
  const currentPlayerIndex =
    overrides.currentPlayerIndex !== undefined ? overrides.currentPlayerIndex : 0;
  const board = overrides.board !== undefined ? overrides.board : createTestBoard(3, 3);
  return store.init(players, currentPlayerIndex, board);
}

function makeMove(source: Coord, direction: Direction): Movement {
  return { sourceCoord: source, direction };
}

function coordsFromDiff(diff: FrameDiff): string[] {
  return diff.map((c) => serializeCoord(c.coord));
}

function tileAt(store: BoardStore, x: number, y: number): TileData {
  return store.getTileData({ x, y });
}

const EMPTY_DIRECTIONS = new Set<Direction>();

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
    queuedDirections: EMPTY_DIRECTIONS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Group 1: Pure functions (tilesEqual, toTileRendererProps)
// ---------------------------------------------------------------------------

describe('tilesEqual', () => {
  it('returns true for identical tile data', () => {
    const dirs = new Set<Direction>();
    const a = makeTileData({ queuedDirections: dirs });
    const b = makeTileData({ queuedDirections: dirs });
    expect(tilesEqual(a, b)).toBe(true);
  });

  it('returns false when any scalar field differs', () => {
    const dirs = new Set<Direction>();
    const a = makeTileData({ armyCount: 5, queuedDirections: dirs });
    const b = makeTileData({ armyCount: 10, queuedDirections: dirs });
    expect(tilesEqual(a, b)).toBe(false);

    const c = makeTileData({ queuedDirections: new Set<Direction>() });
    const d = makeTileData({ queuedDirections: new Set<Direction>() });
    // Different Set references even if contents are equal → false
    expect(tilesEqual(c, d)).toBe(false);
  });

  it('returns false for different queuedDirections reference', () => {
    const a = makeTileData({ queuedDirections: new Set<Direction>() });
    const b = makeTileData({ queuedDirections: new Set<Direction>() });
    expect(tilesEqual(a, b)).toBe(false);
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
      queuedDirections: EMPTY_DIRECTIONS,
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
    const tile = makeTileData({
      coord,
      type: SquareType.BLANK,
      playerIndex: -1,
      queuedDirections: EMPTY_DIRECTIONS,
    });
    const props = toTileRendererProps(tile);
    expect(props.square.type).toBe('BLANK');
    expect((props.square as any).playerIndex).toBeUndefined();
    expect((props.square as any).units).toBeUndefined();
    expect(props.queuedDirections).toBeUndefined();
  });

  it('passes queuedDirections when non-empty', () => {
    const dirs = new Set<Direction>([Direction.RIGHT]);
    const tile = makeTileData({ queuedDirections: dirs });
    const props = toTileRendererProps(tile);
    expect(props.queuedDirections).toBe(dirs);
  });
});

// ---------------------------------------------------------------------------
// Group 2: Init and lifecycle
// ---------------------------------------------------------------------------

describe('BoardStore init and lifecycle', () => {
  it('init with board returns diff containing all tiles', () => {
    const store = new BoardStore();
    const diff = initStore(store, { board: standardBoard() });
    expect(diff.length).toBe(9);
  });

  it('init without board returns empty diff', () => {
    const store = new BoardStore();
    const diff = store.init([], 0, undefined);
    expect(diff).toEqual([]);
  });

  it('init sets board dimensions and source state', () => {
    const store = new BoardStore();
    const players = [{ player_index: 0 }] as any[];
    store.init(players, 1, standardBoard());
    expect(store.width).toBe(3);
    expect(store.height).toBe(3);
    expect(store.source.currentPlayerIndex).toBe(1);
    expect(store.source.players).toBe(players);
  });

  it('init called twice without reset uses second board', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard() });
    const smallBoard = createTestBoard(2, 2);
    const diff2 = initStore(store, { board: smallBoard });
    expect(diff2.length).toBe(4);
    expect(store.width).toBe(2);
    expect(store.height).toBe(2);
  });

  it('reset clears all state to defaults', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard() });
    store.setSelectedTile({ x: 1, y: 1 });
    store.reset();
    expect(store.source.board).toBeNull();
    expect(store.ui.selectedTile).toBeNull();
    expect(store.frame).toEqual([]);
  });

  it('reset clears all subscribers', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard() });
    const cb = vi.fn();
    store.subscribeTile({ x: 1, y: 1 }, cb);
    store.reset();
    // After reset, init again and apply a tick that changes (1,1)
    initStore(store, { board: standardBoard() });
    const newBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
    });
    store.applyTick(1, newBoard, [], []);
    expect(cb).not.toHaveBeenCalled();
  });

  it('applyTick before init returns empty diff', () => {
    const store = new BoardStore();
    const diff = store.applyTick(1, standardBoard(), [], []);
    expect(diff).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Group 3: Tile computation (through BoardStore)
// ---------------------------------------------------------------------------

describe('Tile computation', () => {
  it('blank tile in fog has correct defaults', () => {
    const store = new BoardStore();
    initStore(store, { board: fogBoard(), currentPlayerIndex: 0 });
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
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    const tile = tileAt(store, 1, 1);
    expect(tile.isVisible).toBe(true);
    expect(tile.playerIndex).toBe(0);
    expect(tile.armyCount).toBe(5);
    expect(tile.type).toBe(SquareType.ARMY);
  });

  it('isSelectable true for unselected player tile in active game', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    const tile = tileAt(store, 1, 1);
    expect(tile.isSelectable).toBe(true);
  });

  it('isSelectable false for neutral tile', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    // (1,0) is BLANK
    const tile = tileAt(store, 1, 0);
    expect(tile.isSelectable).toBe(false);
  });

  it('isSelectable false after game ends', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.setStatus('ended');
    const tile = tileAt(store, 1, 1);
    expect(tile.isSelectable).toBe(false);
  });

  it('selected tile shows isSelected true and isSelectable false', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.setSelectedTile({ x: 1, y: 1 });
    const tile = tileAt(store, 1, 1);
    expect(tile.isSelected).toBe(true);
    expect(tile.isSelectable).toBe(false);
  });

  it('tile adjacent to selected non-mountain is a valid move', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.setSelectedTile({ x: 1, y: 1 });
    // (1,0) is BLANK, adjacent above
    const tile = tileAt(store, 1, 0);
    expect(tile.isValidMove).toBe(true);
  });

  it('mountain adjacent to selected is not a valid move', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.setSelectedTile({ x: 1, y: 1 });
    // (2,1) is MOUNTAIN, adjacent right
    const tile = tileAt(store, 2, 1);
    expect(tile.isValidMove).toBe(false);
  });

  it('tile not adjacent to selected is not a valid move', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.setSelectedTile({ x: 1, y: 1 });
    // (0,0) is diagonal — not cardinal adjacent
    const tile = tileAt(store, 0, 0);
    expect(tile.isValidMove).toBe(false);
  });

  it('border flags: visible tile with visible neighbors', () => {
    const store = new BoardStore();
    // standardBoard with player 0 at (1,1) — center of 3x3, all tiles visible
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    const tile = tileAt(store, 1, 1);
    // (1,1) is visible, top neighbor (1,0) is visible → hasTopBorder true
    expect(tile.hasTopBorder).toBe(true);
    // left neighbor (0,1) is visible → hasLeftBorder true
    expect(tile.hasLeftBorder).toBe(true);
  });

  it('border flags: fog tile with no visible neighbors has borders false', () => {
    const store = new BoardStore();
    initStore(store, { board: fogBoard(), currentPlayerIndex: 0 });
    // (4,4) is player 1's tile but player 0 can't see it
    // top neighbor (4,3) and left neighbor (3,4) also in fog
    const tile = tileAt(store, 4, 4);
    expect(tile.hasTopBorder).toBe(false);
    expect(tile.hasLeftBorder).toBe(false);
  });

  it('neighbor visibility flags from adjacent visible tiles', () => {
    const store = new BoardStore();
    // Player 0 at (0,0): visible squares are (0,0),(1,0),(0,1),(1,1)
    initStore(store, { board: fogBoard(), currentPlayerIndex: 0 });
    // (0,2) is NOT visible. Top neighbor (0,1) IS visible.
    const tile = tileAt(store, 0, 2);
    expect(tile.isVisible).toBe(false);
    expect(tile.neighborVisTop).toBe(true);
    // left neighbor (-1,2) is out of bounds → false
    expect(tile.neighborVisLeft).toBe(false);
    expect(tile.hasTopBorder).toBe(true);
    expect(tile.hasLeftBorder).toBe(false);
  });

  it('all tiles visible when game ended', () => {
    const store = new BoardStore();
    initStore(store, { board: fogBoard(), currentPlayerIndex: 0 });
    store.setStatus('ended');
    const tile = tileAt(store, 4, 4);
    expect(tile.isVisible).toBe(true);
  });

  it('all tiles visible when currentPlayerIndex is null', () => {
    const store = new BoardStore();
    initStore(store, { board: fogBoard(), currentPlayerIndex: null });
    const tile = tileAt(store, 4, 4);
    expect(tile.isVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 4: State mutations and diffing
// ---------------------------------------------------------------------------

describe('State mutations and diffing', () => {
  it('applyTick with changed army count diffs only affected tile', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });

    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 10 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    const diff = store.applyTick(1, modifiedBoard, [], []);

    expect(diff.length).toBeLessThan(9);
    expect(coordsFromDiff(diff)).toContain('1,1');
  });

  it('setSelectedTile diffs old and new selection plus adjacents', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });

    store.setSelectedTile({ x: 1, y: 1 });
    const diff2 = store.setSelectedTile({ x: 0, y: 0 });
    const coords = coordsFromDiff(diff2);

    // Old selected (1,1) and new selected (0,0) must be in diff
    expect(coords).toContain('1,1');
    expect(coords).toContain('0,0');
  });

  it('setSelectedTile with already-selected coord returns empty diff', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.setSelectedTile({ x: 1, y: 1 });
    const diff2 = store.setSelectedTile({ x: 1, y: 1 });
    expect(diff2).toEqual([]);
  });

  it('setSelectedTile(null) clears selection', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.setSelectedTile({ x: 1, y: 1 });
    store.setSelectedTile(null);
    expect(tileAt(store, 1, 1).isSelected).toBe(false);
  });

  it('addQueuedMove adds direction to tile queuedDirections', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    expect(tileAt(store, 1, 1).queuedDirections.has(Direction.RIGHT)).toBe(true);
  });

  it('multiple queued moves from same tile accumulate', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    store.addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.DOWN));
    const dirs = tileAt(store, 1, 1).queuedDirections;
    expect(dirs.has(Direction.RIGHT)).toBe(true);
    expect(dirs.has(Direction.DOWN)).toBe(true);
  });

  it('undoLastQueuedMove removes last move', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    store.addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.DOWN));
    store.undoLastQueuedMove();
    const dirs = tileAt(store, 1, 1).queuedDirections;
    expect(dirs.has(Direction.RIGHT)).toBe(true);
    expect(dirs.has(Direction.DOWN)).toBe(false);
  });

  it('setQueuedMoves replaces all queued moves', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    store.addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.DOWN));

    store.setQueuedMoves([makeMove({ x: 1, y: 1 }, Direction.UP)]);
    const dirs = tileAt(store, 1, 1).queuedDirections;
    expect(dirs.has(Direction.UP)).toBe(true);
    expect(dirs.has(Direction.RIGHT)).toBe(false);
    expect(dirs.has(Direction.DOWN)).toBe(false);
  });

  it('setStatus to ended makes all tiles visible and non-selectable', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });
    store.setStatus('ended');
    // (1,1) is a player tile — should be visible but not selectable after end
    expect(tileAt(store, 1, 1).isVisible).toBe(true);
    expect(tileAt(store, 1, 1).isSelectable).toBe(false);
    // fog tile also becomes visible
    const fog = new BoardStore();
    initStore(fog, { board: fogBoard(), currentPlayerIndex: 0 });
    fog.setStatus('ended');
    expect(tileAt(fog, 4, 4).isVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 5: Subscriptions and snapshot stability
// ---------------------------------------------------------------------------

describe('Subscriptions and snapshot stability', () => {
  it('tile subscriber fires only for changed tiles', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });

    const cb11 = vi.fn();
    const cb00 = vi.fn();
    store.subscribeTile({ x: 1, y: 1 }, cb11);
    store.subscribeTile({ x: 0, y: 0 }, cb00);

    // Change only (1,1)
    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    store.applyTick(1, modifiedBoard, [], []);

    expect(cb11).toHaveBeenCalled();
    expect(cb00).not.toHaveBeenCalled();
  });

  it('board subscriber fires on every applyUpdate', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });

    const cb = vi.fn();
    store.subscribe(cb);

    store.setSelectedTile({ x: 1, y: 1 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe prevents future callbacks', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });

    const cb = vi.fn();
    const unsub = store.subscribeTile({ x: 1, y: 1 }, cb);
    unsub();

    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    store.applyTick(1, modifiedBoard, [], []);

    expect(cb).not.toHaveBeenCalled();
  });

  it('getTileData returns same reference when tile unchanged', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });

    const ref1 = tileAt(store, 0, 0);
    // Change a different tile
    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    store.applyTick(1, modifiedBoard, [], []);
    const ref2 = tileAt(store, 0, 0);

    expect(ref1).toBe(ref2);
  });

  it('getTileData returns new reference when tile changed', () => {
    const store = new BoardStore();
    initStore(store, { board: standardBoard(), currentPlayerIndex: 0 });

    const ref1 = tileAt(store, 1, 1);
    const modifiedBoard = createTestBoard(3, 3, {
      '1,1': { type: 'ARMY', playerIndex: 0, units: 99 },
      '0,0': { type: 'GENERAL', playerIndex: 1, units: 1 },
      '2,1': { type: 'MOUNTAIN' },
    });
    store.applyTick(1, modifiedBoard, [], []);
    const ref2 = tileAt(store, 1, 1);

    expect(ref1).not.toBe(ref2);
  });
});

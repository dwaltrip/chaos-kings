import { describe, it, expect } from 'vitest';
import { Direction } from '@core/types';

import {
  modifiedStandardBoard,
  setupStandard,
  setupFog,
  tileAt,
  makeMove,
} from './helpers';

describe('State mutations and diffing', () => {
  it('applyTick with changed army count updates affected tile', () => {
    const { store, applyTick } = setupStandard();
    const refBefore = store.getTileData({ x: 0, y: 0 });

    applyTick(1, modifiedStandardBoard(10), [], []);

    // Changed tile has new data
    expect(store.getTileData({ x: 1, y: 1 }).armyCount).toBe(10);
    // Unchanged tile — same reference
    expect(store.getTileData({ x: 0, y: 0 })).toBe(refBefore);
  });

  it('setSelectedTile updates old and new selected tiles', () => {
    const { store, setSelectedTile } = setupStandard();

    setSelectedTile({ x: 1, y: 1 });
    expect(store.getTileData({ x: 1, y: 1 }).isSelected).toBe(true);

    setSelectedTile({ x: 0, y: 0 });
    expect(store.getTileData({ x: 1, y: 1 }).isSelected).toBe(false);
    expect(store.getTileData({ x: 0, y: 0 }).isSelected).toBe(true);
  });

  it('setSelectedTile with same coord does not change tile data', () => {
    const { store, setSelectedTile } = setupStandard();
    setSelectedTile({ x: 1, y: 1 });

    const refBefore = store.getTileData({ x: 1, y: 1 });
    setSelectedTile({ x: 1, y: 1 });
    const refAfter = store.getTileData({ x: 1, y: 1 });
    expect(refBefore).toBe(refAfter);
  });

  it('setSelectedTile(null) clears selection', () => {
    const { store, setSelectedTile } = setupStandard();
    setSelectedTile({ x: 1, y: 1 });
    setSelectedTile(null);
    expect(tileAt(store, 1, 1).isSelected).toBe(false);
  });

  it('addQueuedMove adds direction to tile', () => {
    const { store, addQueuedMove } = setupStandard();
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    expect(tileAt(store, 1, 1).queuedRight).toBe(true);
  });

  it('multiple queued moves from same tile accumulate', () => {
    const { store, addQueuedMove } = setupStandard();
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.DOWN));
    const tile = tileAt(store, 1, 1);
    expect(tile.queuedRight).toBe(true);
    expect(tile.queuedDown).toBe(true);
  });

  it('undoLastQueuedMove removes last move', () => {
    const { store, addQueuedMove, undoLastQueuedMove } = setupStandard();
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.DOWN));
    undoLastQueuedMove();
    const tile = tileAt(store, 1, 1);
    expect(tile.queuedRight).toBe(true);
    expect(tile.queuedDown).toBe(false);
  });

  it('setQueuedMoves replaces all queued moves', () => {
    const { store, addQueuedMove, setQueuedMoves } = setupStandard();
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.RIGHT));
    addQueuedMove(makeMove({ x: 1, y: 1 }, Direction.DOWN));

    setQueuedMoves([makeMove({ x: 1, y: 1 }, Direction.UP)]);
    const tile = tileAt(store, 1, 1);
    expect(tile.queuedUp).toBe(true);
    expect(tile.queuedRight).toBe(false);
    expect(tile.queuedDown).toBe(false);
  });

  it('setStatus to ended makes all tiles visible and non-selectable', () => {
    const { store, setStatus } = setupStandard();
    setStatus('ended');
    expect(tileAt(store, 1, 1).isVisible).toBe(true);
    expect(tileAt(store, 1, 1).isSelectable).toBe(false);

    // Also verify with fog board
    const { store: fogStore, setStatus: fogSetStatus } = setupFog();
    fogSetStatus('ended');
    expect(tileAt(fogStore, 4, 4).isVisible).toBe(true);
  });
});

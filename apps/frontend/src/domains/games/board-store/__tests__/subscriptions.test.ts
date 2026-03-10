import { describe, it, expect, vi } from 'vitest';

import {
  standardBoard,
  modifiedStandardBoard,
  setupStandard,
  setupFog,
  tileAt,
} from './helpers';

describe('Subscriptions and snapshot stability', () => {
  it('tile subscriber fires only for changed tiles', () => {
    const { store, applyTick } = setupStandard();

    const cb11 = vi.fn();
    const cb00 = vi.fn();
    store.subscribeTile({ x: 1, y: 1 }, cb11);
    store.subscribeTile({ x: 0, y: 0 }, cb00);

    applyTick(1, modifiedStandardBoard(), [], []);

    expect(cb11).toHaveBeenCalled();
    expect(cb00).not.toHaveBeenCalled();
  });

  it('tile subscriber does NOT fire when tile data unchanged', () => {
    const { store, setSelectedTile } = setupStandard();

    const cb = vi.fn();
    // Subscribe to a tile far from any selection changes
    store.subscribeTile({ x: 2, y: 2 }, cb);

    // setSelectedTile only affects (1,1) and adjacent tiles
    setSelectedTile({ x: 1, y: 1 });
    // (2,2) is not adjacent to (1,1), so its tile data is unchanged
    expect(cb).not.toHaveBeenCalled();
  });

  it('no-op action: tile subscribers silent, board subscriber still fires', () => {
    const { store, setSelectedTile } = setupStandard();
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
    const { store, setSelectedTile } = setupStandard();

    const cb = vi.fn();
    store.subscribe(cb);

    setSelectedTile({ x: 1, y: 1 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe prevents future callbacks', () => {
    const { store, applyTick } = setupStandard();

    const cb = vi.fn();
    const unsub = store.subscribeTile({ x: 1, y: 1 }, cb);
    unsub();

    applyTick(1, modifiedStandardBoard(), [], []);

    expect(cb).not.toHaveBeenCalled();
  });

  it('getTileData returns same reference when tile unchanged', () => {
    const { store, applyTick } = setupStandard();

    const ref1 = tileAt(store, 0, 0);
    applyTick(1, modifiedStandardBoard(), [], []);
    const ref2 = tileAt(store, 0, 0);

    expect(ref1).toBe(ref2);
  });

  it('getTileData returns new reference when tile changed', () => {
    const { store, applyTick } = setupStandard();

    const ref1 = tileAt(store, 1, 1);
    applyTick(1, modifiedStandardBoard(), [], []);
    const ref2 = tileAt(store, 1, 1);

    expect(ref1).not.toBe(ref2);
  });

  it('derived is accessible and correct', () => {
    const { store, setStatus } = setupFog();
    expect(store.derived.allVisible).toBe(false);

    setStatus('ended');
    expect(store.derived.allVisible).toBe(true);
  });

  it('reset → re-init full cycle: fresh state and working subscriptions', () => {
    const { store, initBoard, applyTick, setSelectedTile } = setupStandard();
    // Mutate
    setSelectedTile({ x: 1, y: 1 });
    expect(tileAt(store, 1, 1).isSelected).toBe(true);

    // Reset
    store.reset();
    expect(store.state.game.board).toBeNull();
    expect(store.version).toBe(0);

    // Re-init
    initBoard([], 0, standardBoard());
    expect(tileAt(store, 1, 1).isSelected).toBe(false);
    expect(tileAt(store, 1, 1).armyCount).toBe(5);

    // Subscriptions work after re-init
    const cb = vi.fn();
    store.subscribeTile({ x: 1, y: 1 }, cb);
    applyTick(1, modifiedStandardBoard(), [], []);
    expect(cb).toHaveBeenCalled();
    expect(tileAt(store, 1, 1).armyCount).toBe(99);
  });

  it('version increments on each action', () => {
    const { store, setSelectedTile } = setupStandard();
    // initBoard already ran once in setupStandard, so version is 1
    expect(store.version).toBe(1);
    setSelectedTile({ x: 1, y: 1 });
    expect(store.version).toBe(2);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { SquareType } from '@core/types';

import {
  createTestBoard,
  standardBoard,
  modifiedStandardBoard,
  setup,
  setupStandard,
  tileAt,
} from './helpers';

describe('BoardStore init and lifecycle', () => {
  it('init with board populates tile cache', () => {
    const { store } = setupStandard();
    const tile = tileAt(store, 1, 1);
    expect(tile.armyCount).toBe(5);
    expect(tile.type).toBe(SquareType.ARMY);
  });

  it('init without board does not error', () => {
    const { store, initBoard } = setup();
    initBoard([], 0);
    expect(store.state.game.board).toBeNull();
  });

  it('init sets source state', () => {
    const { store, initBoard } = setup();
    const players = [{ player_index: 0 }] as any[];
    initBoard(players, 1, standardBoard());
    expect(store.state.game.board!.size.width).toBe(3);
    expect(store.state.game.board!.size.height).toBe(3);
    expect(store.state.game.currentPlayerIndex).toBe(1);
    expect(store.state.game.players).toBe(players);
  });

  it('init called twice without reset uses second board', () => {
    const { store, initBoard } = setupStandard();
    const smallBoard = createTestBoard(2, 2);
    initBoard([], 0, smallBoard);
    expect(store.state.game.board!.size.width).toBe(2);
    expect(store.state.game.board!.size.height).toBe(2);
  });

  it('reset clears all state to defaults', () => {
    const { store, setSelectedTile } = setupStandard();
    setSelectedTile({ x: 1, y: 1 });
    store.reset();
    expect(store.state.game.board).toBeNull();
    expect(store.state.ui.selectedTile).toBeNull();
  });

  it('reset clears tile subscribers but keeps board subscribers', () => {
    const { store, initBoard, applyTick } = setupStandard();

    const tileCb = vi.fn();
    const boardCb = vi.fn();
    store.subscribeTile({ x: 1, y: 1 }, tileCb);
    store.subscribe(boardCb);

    store.reset();
    // Board subscriber fires on reset
    expect(boardCb).toHaveBeenCalledTimes(1);

    // After reset, init again and change (1,1)
    initBoard([], 0, standardBoard());
    applyTick(1, modifiedStandardBoard(), [], []);

    // Tile subscriber was cleared by reset — not called
    expect(tileCb).not.toHaveBeenCalled();
    // Board subscriber still active: reset(1) + initBoard(2) + applyTick(3)
    expect(boardCb).toHaveBeenCalledTimes(3);
  });

  it('applyTick before initBoard sets state without error', () => {
    const { store, applyTick } = setup();
    applyTick(1, standardBoard(), [], []);
    expect(store.state.game.tick).toBe(1);
    expect(store.state.game.board).not.toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { SquareType } from '@core/types';

import { fogBoard, setup, setupStandard, setupFog, tileAt } from './helpers';

describe('Tile computation', () => {
  it('blank tile in fog has correct defaults', () => {
    const { store } = setupFog();
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
    const { store } = setupStandard();
    const tile = tileAt(store, 1, 1);
    expect(tile.isVisible).toBe(true);
    expect(tile.playerIndex).toBe(0);
    expect(tile.armyCount).toBe(5);
    expect(tile.type).toBe(SquareType.ARMY);
  });

  it('isSelectable true for unselected player tile in active game', () => {
    const { store } = setupStandard();
    const tile = tileAt(store, 1, 1);
    expect(tile.isSelectable).toBe(true);
  });

  it('isSelectable false for neutral tile', () => {
    const { store } = setupStandard();
    const tile = tileAt(store, 1, 0);
    expect(tile.isSelectable).toBe(false);
  });

  it('isSelectable false after game ends', () => {
    const { store, setStatus } = setupStandard();
    setStatus('ended');
    const tile = tileAt(store, 1, 1);
    expect(tile.isSelectable).toBe(false);
  });

  it('selected tile shows isSelected true and isSelectable false', () => {
    const { store, setSelectedTile } = setupStandard();
    setSelectedTile({ x: 1, y: 1 });
    const tile = tileAt(store, 1, 1);
    expect(tile.isSelected).toBe(true);
    expect(tile.isSelectable).toBe(false);
  });

  it('tile adjacent to selected non-mountain is a valid move', () => {
    const { store, setSelectedTile } = setupStandard();
    setSelectedTile({ x: 1, y: 1 });
    const tile = tileAt(store, 1, 0);
    expect(tile.isValidMove).toBe(true);
  });

  it('mountain adjacent to selected is not a valid move', () => {
    const { store, setSelectedTile } = setupStandard();
    setSelectedTile({ x: 1, y: 1 });
    const tile = tileAt(store, 2, 1);
    expect(tile.isValidMove).toBe(false);
  });

  it('tile not adjacent to selected is not a valid move', () => {
    const { store, setSelectedTile } = setupStandard();
    setSelectedTile({ x: 1, y: 1 });
    const tile = tileAt(store, 0, 0);
    expect(tile.isValidMove).toBe(false);
  });

  it('border flags: visible tile with visible neighbors', () => {
    const { store } = setupStandard();
    const tile = tileAt(store, 1, 1);
    expect(tile.hasTopBorder).toBe(true);
    expect(tile.hasLeftBorder).toBe(true);
  });

  it('border flags: fog tile with no visible neighbors has borders false', () => {
    const { store } = setupFog();
    const tile = tileAt(store, 4, 4);
    expect(tile.hasTopBorder).toBe(false);
    expect(tile.hasLeftBorder).toBe(false);
  });

  it('neighbor visibility flags from adjacent visible tiles', () => {
    const { store } = setupFog();
    const tile = tileAt(store, 0, 2);
    expect(tile.isVisible).toBe(false);
    expect(tile.neighborVisTop).toBe(true);
    expect(tile.neighborVisLeft).toBe(false);
    expect(tile.hasTopBorder).toBe(true);
    expect(tile.hasLeftBorder).toBe(false);
  });

  it('all tiles visible when game ended', () => {
    const { store, setStatus } = setupFog();
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

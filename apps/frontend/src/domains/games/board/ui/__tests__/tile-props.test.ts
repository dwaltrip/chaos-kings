import { describe, it, expect } from 'vitest';
import { Direction, SquareType } from '@core/types';

import { makeTileData } from '@/domains/games/board-store/__tests__/helpers';

import { toTileRendererProps } from '../tile-props';

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

import { Direction, NeutralSquareType, PlayerSquareType } from '@core/types';
import type { NeutralSquare, PlayerSquare } from '@core/types';

import type { TileRendererProps } from '@/domains/gameplay/ui/tile-renderer';
import type { TileData } from './types';

function tilesEqual(a: TileData, b: TileData): boolean {
  return (
    a.type === b.type &&
    a.playerIndex === b.playerIndex &&
    a.armyCount === b.armyCount &&
    a.isVisible === b.isVisible &&
    a.neighborVisTop === b.neighborVisTop &&
    a.neighborVisLeft === b.neighborVisLeft &&
    a.isSelected === b.isSelected &&
    a.isSelectable === b.isSelectable &&
    a.isValidMove === b.isValidMove &&
    a.hasTopBorder === b.hasTopBorder &&
    a.hasLeftBorder === b.hasLeftBorder &&
    a.queuedUp === b.queuedUp &&
    a.queuedDown === b.queuedDown &&
    a.queuedLeft === b.queuedLeft &&
    a.queuedRight === b.queuedRight
  );
}

function toQueuedDirectionsSet(tile: TileData): Set<Direction> | undefined {
  if (!tile.queuedUp && !tile.queuedDown && !tile.queuedLeft && !tile.queuedRight) {
    return undefined;
  }
  const dirs = new Set<Direction>();
  if (tile.queuedUp) dirs.add(Direction.UP);
  if (tile.queuedDown) dirs.add(Direction.DOWN);
  if (tile.queuedLeft) dirs.add(Direction.LEFT);
  if (tile.queuedRight) dirs.add(Direction.RIGHT);
  return dirs;
}

function toTileRendererProps(tile: TileData): Omit<TileRendererProps, 'onClick'> {
  const square =
    tile.playerIndex >= 0
      ? ({
          coord: tile.coord,
          type: tile.type as PlayerSquareType,
          playerIndex: tile.playerIndex,
          units: tile.armyCount,
        } satisfies PlayerSquare)
      : ({
          coord: tile.coord,
          type: tile.type as NeutralSquareType,
        } satisfies NeutralSquare);

  return {
    coord: tile.coord,
    square,
    isVisible: tile.isVisible,
    hasTopBorder: tile.hasTopBorder,
    hasLeftBorder: tile.hasLeftBorder,
    isSelected: tile.isSelected,
    isSelectable: tile.isSelectable,
    isValidMove: tile.isValidMove,
    queuedDirections: toQueuedDirectionsSet(tile),
  };
}

export { tilesEqual, toTileRendererProps };

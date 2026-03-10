import { Direction, NeutralSquareType, PlayerSquareType } from '@core/types';
import type { NeutralSquare, PlayerSquare } from '@core/types';

import type { TileData } from '@/domains/games/board-store/types';

import type { TileRendererProps } from './tile-renderer';

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

export { toTileRendererProps, toQueuedDirectionsSet };

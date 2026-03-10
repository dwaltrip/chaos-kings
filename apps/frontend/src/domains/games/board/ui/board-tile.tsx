import React from 'react';

import { Direction, NeutralSquareType, PlayerSquareType } from '@core/types';
import type { Coord, NeutralSquare, PlayerSquare } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';

import type { BoardStoreInstance } from '@/domains/games/board-store/board-store';
import type { TileData } from '@/domains/games/board-store/types';
import { useTileData } from '@/domains/games/board-store/hooks';

import type { TileRendererProps } from './tile-renderer';
import { TileRenderer } from './tile-renderer';

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

interface BoardTileProps {
  store: BoardStoreInstance;
  coord: Coord;
  onClick?: () => void;
}

const BoardTile = React.memo(
  function BoardTile({ store, coord, onClick }: BoardTileProps) {
    const tile = useTileData(store, coord);
    const rendererProps: TileRendererProps = {
      ...toTileRendererProps(tile),
      onClick: tile.isSelectable ? onClick : undefined,
    };
    return <TileRenderer {...rendererProps} />;
  },
  (prev, next) =>
    areCoordsEqual(prev.coord, next.coord) &&
    prev.store === next.store &&
    prev.onClick === next.onClick,
);

export type { BoardTileProps };
export { BoardTile, toTileRendererProps, toQueuedDirectionsSet };

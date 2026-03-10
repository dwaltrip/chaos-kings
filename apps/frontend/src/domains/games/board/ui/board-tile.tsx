import React from 'react';

import type { Coord } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';

import type { BoardStoreInstance } from '@/domains/games/board-store/board-store';
import { useTileData } from '@/domains/games/board-store/hooks';

import type { TileRendererProps } from './tile-renderer';
import { TileRenderer } from './tile-renderer';
import { toTileRendererProps } from './tile-data-transforms';

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
export { BoardTile };

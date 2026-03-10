import React from 'react';

import type { Coord } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';

import { boardStore, setSelectedTile } from '@/domains/games/board-store';
import { toTileRendererProps } from '@/domains/games/board-store/tile-data';
import { useTileData } from '@/domains/games/board-store/hooks';
import { TileRenderer } from '@/domains/gameplay/ui/tile-renderer';

interface GameTileProps {
  coord: Coord;
}

const GameTile = React.memo(
  ({ coord }: GameTileProps) => {
    const tile = useTileData(boardStore, coord);
    const rendererProps = toTileRendererProps(tile);
    return (
      <TileRenderer
        {...rendererProps}
        onClick={tile.isSelectable ? () => setSelectedTile(coord) : undefined}
      />
    );
  },
  (prevProps, nextProps) => areCoordsEqual(prevProps.coord, nextProps.coord),
);

GameTile.displayName = 'GameTile';

export { GameTile };

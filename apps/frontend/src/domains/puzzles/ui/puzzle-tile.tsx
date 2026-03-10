import React from 'react';

import type { Coord } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';

import { boardStore, setSelectedTile } from '@/domains/games/board-store';
import { useTileData } from '@/domains/games/board-store/hooks';
import { toTileRendererProps } from '@/domains/games/board-store/tile-data';
import { TileRenderer } from '@/domains/gameplay/ui/tile-renderer';

interface PuzzleTileProps {
  coord: Coord;
}

const PuzzleTile = React.memo(
  ({ coord }: PuzzleTileProps) => {
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

PuzzleTile.displayName = 'PuzzleTile';

export { PuzzleTile };

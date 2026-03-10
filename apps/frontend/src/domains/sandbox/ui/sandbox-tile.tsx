import React from 'react';

import type { Coord } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';

import { boardStore, setSelectedTile } from '@/domains/games/board-store';
import { useTileData } from '@/domains/games/board-store/hooks';
import { toTileRendererProps } from '@/domains/games/board/ui/tile-data-transforms';
import { TileRenderer } from '@/domains/games/board/ui/tile-renderer';

interface SandboxTileProps {
  coord: Coord;
}

const SandboxTile = React.memo(
  ({ coord }: SandboxTileProps) => {
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

SandboxTile.displayName = 'SandboxTile';

export { SandboxTile };

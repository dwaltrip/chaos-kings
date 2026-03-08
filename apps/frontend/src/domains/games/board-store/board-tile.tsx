import type { Coord } from '@core/types';

import type { TileRendererProps } from '@/domains/gameplay/ui/tile-renderer';
import { TileRenderer } from '@/domains/gameplay/ui/tile-renderer';

import type { BoardStore } from './board-store';
import { toTileRendererProps } from './tile-data';
import { useBoardSourceState, useTileData } from './hooks';

interface BoardTileProps {
  store: BoardStore;
  coord: Coord;
  onClick?: () => void;
}

function BoardTile({ store, coord, onClick }: BoardTileProps) {
  const tile = useTileData(store, coord);
  const rendererProps: TileRendererProps = {
    ...toTileRendererProps(tile),
    onClick: tile.isSelectable ? onClick : undefined,
  };
  return <TileRenderer {...rendererProps} />;
}

export type { BoardTileProps };
export { useTileData, useBoardSourceState, BoardTile };

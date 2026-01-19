import React from 'react';

import type { Coord } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';

import { useRenderCounter } from '@/lib/use-render-counter';
import {
  useTileQueuedDirections,
  useTileSquare,
  useTileSquareTypes,
} from '@/domains/games/hooks/use-tile-store-state';
import {
  useGameplayStoreV2,
  useIsAdjacentToSelected,
  useIsGameEnded,
  useIsTileSelected,
} from '@/domains/gameplay/stores/gameplay-store-v2';
import {
  useIsVisible,
  useNeighborVisibility,
} from '@/domains/gameplay/hooks/use-visibility';
import { TileRenderer } from '@/domains/gameplay/ui/tile-renderer';

interface GameTileProps {
  coord: Coord;
}

const { setSelectedTileV2 } = useGameplayStoreV2.getState().actions;

const GameTile = React.memo(
  ({ coord }: GameTileProps) => {
    useRenderCounter('game-tile')();

    const isGameEnded = useGameplayStoreV2(useIsGameEnded);
    const square = useTileSquare(coord);
    const isSelected = useGameplayStoreV2(useIsTileSelected(coord));
    const selectTileV2 = () => setSelectedTileV2(coord);
    const isNeighborOfSelected = useGameplayStoreV2(useIsAdjacentToSelected(coord));

    const queuedDirections = useTileQueuedDirections(coord);
    const isVisible = useGameplayStoreV2(useIsVisible(coord));
    const neighborVisibility = useGameplayStoreV2(useNeighborVisibility(coord));

    const { isMountain } = useTileSquareTypes(coord);

    const isSelectable = !isGameEnded && !(isMountain || isSelected);
    const isValidMove = isNeighborOfSelected && !isMountain;

    const hasTopBorder = isVisible || neighborVisibility.top;
    const hasLeftBorder = isVisible || neighborVisibility.left;

    return (
      <TileRenderer
        coord={coord}
        square={square}
        isVisible={isVisible}
        hasTopBorder={hasTopBorder}
        hasLeftBorder={hasLeftBorder}
        isSelected={isSelected}
        isSelectable={isSelectable}
        isValidMove={isValidMove}
        queuedDirections={queuedDirections}
        onClick={isSelectable ? selectTileV2 : undefined}
      />
    );
  },
  // TODO: Do I need this? or is there a nicer way to do it?
  (prevProps, nextProps) => {
    // Only re-render if coordinate actually changed
    return areCoordsEqual(prevProps.coord, nextProps.coord);
  },
);

GameTile.displayName = 'GameTile';

export { GameTile };

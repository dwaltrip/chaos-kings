import React from 'react';

import type { Coord } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';
import { isMountainSquare, isPlayerSquare } from '@core/square';

import {
  useTileQueuedDirections,
  useTileSquare,
} from '@/domains/games/hooks/use-tile-store-state';
import { TileRenderer } from '@/domains/gameplay/ui/tile-renderer';
import {
  useBoardSessionStore,
  selectIsTileSelected,
  selectIsAdjacentToSelected,
  selectIsEnded,
  selectIsVisible,
  selectNeighborVisibility,
} from '@/domains/games/stores/board-session-store';

interface SandboxTileProps {
  coord: Coord;
}

const { setSelectedTile } = useBoardSessionStore.getState().actions;

// TODO: This is the "unified" tile - migrate GameTile/PuzzleTile to use BoardSessionStore
const SandboxTile = React.memo(
  ({ coord }: SandboxTileProps) => {
    const square = useTileSquare(coord);
    const queuedDirections = useTileQueuedDirections(coord);

    const isEnded = useBoardSessionStore(selectIsEnded);
    const isSelected = useBoardSessionStore(selectIsTileSelected(coord));
    const isAdjacentToSelected = useBoardSessionStore(selectIsAdjacentToSelected(coord));
    const isVisible = useBoardSessionStore(selectIsVisible(coord));
    const neighborVisibility = useBoardSessionStore(selectNeighborVisibility(coord));

    const isMountain = isMountainSquare(square);
    const isSelectable = !isSelected && !isEnded && isPlayerSquare(square);
    const isValidMove = isAdjacentToSelected && !isMountain;

    const hasTopBorder = isVisible || neighborVisibility.top;
    const hasLeftBorder = isVisible || neighborVisibility.left;

    const selectTile = () => setSelectedTile(coord);

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
        onClick={isSelectable ? selectTile : undefined}
      />
    );
  },
  (prevProps, nextProps) => areCoordsEqual(prevProps.coord, nextProps.coord),
);

SandboxTile.displayName = 'SandboxTile';

export { SandboxTile };

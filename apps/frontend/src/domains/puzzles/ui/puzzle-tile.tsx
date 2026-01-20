import React from 'react';

import type { Coord } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';
import { isMountainSquare } from '@core/square';

import {
  useTileQueuedDirections,
  useTileSquare,
} from '@/domains/games/hooks/use-tile-store-state';
import { TileRenderer } from '@/domains/gameplay/ui/tile-renderer';
import {
  usePuzzleStore,
  selectIsTileSelected,
  selectIsAdjacentToSelected,
  selectIsPuzzleEnded,
  selectIsVisible,
  selectNeighborVisibility,
} from '@/domains/puzzles/stores/puzzle-store';

interface PuzzleTileProps {
  coord: Coord;
}

const { setSelectedTile } = usePuzzleStore.getState().actions;

const PuzzleTile = React.memo(
  ({ coord }: PuzzleTileProps) => {
    // Per-tile store subscriptions (only re-render when THIS tile's data changes)
    const square = useTileSquare(coord);
    const queuedDirections = useTileQueuedDirections(coord);

    // Parameterized selectors (only re-render when relevant state changes)
    const isPuzzleEnded = usePuzzleStore(selectIsPuzzleEnded);
    const isSelected = usePuzzleStore(selectIsTileSelected(coord));
    const isAdjacentToSelected = usePuzzleStore(selectIsAdjacentToSelected(coord));
    const isVisible = usePuzzleStore(selectIsVisible(coord));
    const neighborVisibility = usePuzzleStore(selectNeighborVisibility(coord));

    const isMountain = isMountainSquare(square);
    const isSelectable = !isPuzzleEnded && !isMountain && !isSelected;
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

PuzzleTile.displayName = 'PuzzleTile';

export { PuzzleTile };

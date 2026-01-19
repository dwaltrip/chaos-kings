import React from 'react';

import type { Coord, Direction } from '@core/types';
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
  puzzleActions,
} from '@/domains/puzzles/stores/puzzle-store';
import { queueMove } from '@/domains/puzzles/actions/puzzle-actions';

function getDirection(from: Coord, to: Coord): Direction | null {
  if (to.x === from.x + 1 && to.y === from.y) return 'RIGHT';
  if (to.x === from.x - 1 && to.y === from.y) return 'LEFT';
  if (to.y === from.y + 1 && to.x === from.x) return 'DOWN';
  if (to.y === from.y - 1 && to.x === from.x) return 'UP';
  return null;
}

interface PuzzleTileProps {
  coord: Coord;
}

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

    const handleClick = () => {
      if (isPuzzleEnded) return;

      const { setSelectedTile } = puzzleActions();

      // If clicking a valid move target, queue the move
      if (isAdjacentToSelected && isValidMove) {
        // Need selectedTile to compute direction - get it from store
        const selectedTile = usePuzzleStore.getState().selectedTile;
        if (selectedTile) {
          const direction = getDirection(selectedTile, coord);
          if (direction) {
            queueMove(selectedTile, direction);
            return;
          }
        }
      }

      // Otherwise, select/deselect this tile
      if (isSelectable) {
        setSelectedTile(coord);
      } else if (isSelected) {
        setSelectedTile(null);
      }
    };

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
        onClick={!isPuzzleEnded ? handleClick : undefined}
      />
    );
  },
  (prevProps, nextProps) => areCoordsEqual(prevProps.coord, nextProps.coord),
);

PuzzleTile.displayName = 'PuzzleTile';

export { PuzzleTile };

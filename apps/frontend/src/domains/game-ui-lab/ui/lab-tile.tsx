import React from 'react';

import type { Coord, Direction, Square } from '@core/types';

import { TileRenderer } from '@/domains/games/board/ui/tile-renderer';

interface LabTileProps {
  coord: Coord;
  square: Square;
  isVisible: boolean;
  neighborVisibility: { top: boolean; left: boolean };
  queuedDirections?: Set<Direction>;
  isSelected?: boolean;
  isValidMove?: boolean;
}

const LabTile = React.memo(
  ({
    coord,
    square,
    isVisible,
    neighborVisibility,
    queuedDirections,
    isSelected,
    isValidMove,
  }: LabTileProps) => {
    const hasTopBorder = isVisible || neighborVisibility.top;
    const hasLeftBorder = isVisible || neighborVisibility.left;

    return (
      <TileRenderer
        coord={coord}
        square={square}
        isVisible={isVisible}
        hasTopBorder={hasTopBorder}
        hasLeftBorder={hasLeftBorder}
        queuedDirections={queuedDirections}
        isSelected={isSelected}
        isValidMove={isValidMove}
      />
    );
  },
);

LabTile.displayName = 'LabTile';

export { LabTile };

import type { Coord, Square } from '@core/types';

import { TileRenderer } from '@/domains/games/board/ui/tile-renderer';

interface ReplayTileProps {
  coord: Coord;
  square: Square;
  isVisible?: boolean; // For future POV mode support
}

function ReplayTile({ coord, square, isVisible = true }: ReplayTileProps) {
  // Simple border logic - show borders when visible
  const hasTopBorder = isVisible;
  const hasLeftBorder = isVisible;

  return (
    <TileRenderer
      coord={coord}
      square={square}
      isVisible={isVisible}
      hasTopBorder={hasTopBorder}
      hasLeftBorder={hasLeftBorder}
    />
  );
}

export type { ReplayTileProps };
export { ReplayTile };

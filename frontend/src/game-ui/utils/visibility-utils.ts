import type { Coord } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

function isSquareVisible(
  coord: Coord,
  visibleSquares: Set<string>,
  currentPlayerIndex: number | null,
): boolean {
  if (currentPlayerIndex === null) return true;
  return visibleSquares.has(serializeCoord(coord));
}

export { isSquareVisible };

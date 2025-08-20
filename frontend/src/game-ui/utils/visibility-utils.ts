import type { Coord, Square, SquareType } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

export function isSquareVisible(
  coord: Coord,
  visibleSquares: Set<string>,
  currentPlayerIndex: number | null,
): boolean {
  if (currentPlayerIndex === null) return true;
  return visibleSquares.has(serializeCoord(coord));
}

export function shouldShowMountain(square: Square): boolean {
  return square.type === ('MOUNTAIN' as SquareType);
}

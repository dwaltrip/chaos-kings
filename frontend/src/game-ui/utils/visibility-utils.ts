import type { Coord, Square, SquareType } from '@core/types';

export function isSquareVisible(
  coord: Coord,
  visibleSquares: Set<Coord>,
  currentPlayerIndex: number | null,
): boolean {
  if (currentPlayerIndex === null) return true;
  return Array.from(visibleSquares).some(
    (visibleCoord) => visibleCoord.x === coord.x && visibleCoord.y === coord.y,
  );
}

export function shouldShowMountain(square: Square): boolean {
  return square.type === ('MOUNTAIN' as SquareType);
}

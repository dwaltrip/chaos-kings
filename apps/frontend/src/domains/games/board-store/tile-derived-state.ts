import { isPlayerSquare, isMountainSquare } from '@core/square';
import type { Coord, Square } from '@core/types';
import { serializeCoord, isAdjacentTo } from '@core/utils/coordinate-utils';

import type { DerivedState } from './types';

type NeighborVis = {
  top: boolean;
  left: boolean;
};

function getNeighborVis(
  coord: Coord,
  visibleSquares: Set<string>,
  allVisible: boolean,
): NeighborVis {
  const top =
    coord.y > 0 &&
    (allVisible || visibleSquares.has(serializeCoord({ x: coord.x, y: coord.y - 1 })));
  const left =
    coord.x > 0 &&
    (allVisible || visibleSquares.has(serializeCoord({ x: coord.x - 1, y: coord.y })));
  return { top, left };
}

function getIsVisible(coordKey: string, derived: DerivedState): boolean {
  return derived.allVisible || derived.visibleSquares.has(coordKey);
}

function getIsSelected(coord: Coord, selectedTile: Coord | null): boolean {
  return (
    selectedTile !== null && selectedTile.x === coord.x && selectedTile.y === coord.y
  );
}

function getIsSelectable(
  square: Square,
  isSelected: boolean,
  status: 'active' | 'ended',
): boolean {
  return !isSelected && status !== 'ended' && isPlayerSquare(square);
}

function getIsValidMove(
  coord: Coord,
  square: Square,
  selectedTile: Coord | null,
): boolean {
  return (
    selectedTile !== null &&
    isAdjacentTo(selectedTile, coord) &&
    !isMountainSquare(square)
  );
}

function getBorders(
  isVisible: boolean,
  neighborVis: NeighborVis,
): { hasTopBorder: boolean; hasLeftBorder: boolean } {
  return {
    hasTopBorder: isVisible || neighborVis.top,
    hasLeftBorder: isVisible || neighborVis.left,
  };
}

export type { NeighborVis };
export {
  getNeighborVis,
  getIsVisible,
  getIsSelected,
  getIsSelectable,
  getIsValidMove,
  getBorders,
};

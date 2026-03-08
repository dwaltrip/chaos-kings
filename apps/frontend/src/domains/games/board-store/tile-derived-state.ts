import { isPlayerSquare, isMountainSquare } from '@core/square';
import { serializeCoord, isAdjacentTo } from '@core/utils/coordinate-utils';

import type { DerivedState } from './types';
import { Board } from '@core/board';
import type { Coord, Square } from '@core/types';

import type { FrameInputs, TileData } from './types';

interface QueuedDirs {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

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

const NO_QUEUED: QueuedDirs = { up: false, down: false, left: false, right: false };

function computeTileData(
  inputs: FrameInputs,
  coord: Coord,
  queuedMovesMap: Map<string, QueuedDirs>,
): TileData {
  const board = inputs.source.board!;
  const square = Board.getSquare(board, coord);
  const coordKey = serializeCoord(coord);

  const isVisible = getIsVisible(coordKey, inputs.derived);
  const neighborVis = getNeighborVis(
    coord,
    inputs.derived.visibleSquares,
    inputs.derived.allVisible,
  );
  const isSelected = getIsSelected(coord, inputs.ui.selectedTile);
  const isSelectable = getIsSelectable(square, isSelected, inputs.source.status);
  const isValidMove = getIsValidMove(coord, square, inputs.ui.selectedTile);
  const borders = getBorders(isVisible, neighborVis);

  const queued = queuedMovesMap.get(coordKey) ?? NO_QUEUED;
  const playerIndex = isPlayerSquare(square) ? square.playerIndex : -1;
  const armyCount = isPlayerSquare(square) ? square.units : 0;

  return {
    coord,
    type: square.type,
    playerIndex,
    armyCount,
    isVisible,
    neighborVisTop: neighborVis.top,
    neighborVisLeft: neighborVis.left,
    isSelected,
    isSelectable,
    isValidMove,
    hasTopBorder: borders.hasTopBorder,
    hasLeftBorder: borders.hasLeftBorder,
    queuedUp: queued.up,
    queuedDown: queued.down,
    queuedLeft: queued.left,
    queuedRight: queued.right,
  };
}

export type { NeighborVis, QueuedDirs };
export { computeTileData };

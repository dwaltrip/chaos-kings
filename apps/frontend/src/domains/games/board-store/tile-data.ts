import { Board } from '@core/board';
import { isPlayerSquare, isMountainSquare } from '@core/square';
import { Direction, NeutralSquareType, PlayerSquareType } from '@core/types';
import type { NeutralSquare, PlayerSquare } from '@core/types';
import { serializeCoord, isAdjacentTo } from '@core/utils/coordinate-utils';

import type { TileRendererProps } from '@/domains/gameplay/ui/tile-renderer';

import type { FrameInputs, TileData } from './types';
import type { Coord } from '@core/types';

// Stable empty set reused for tiles with no queued moves — preserves reference equality
const EMPTY_DIRECTIONS = new Set<Direction>();

function computeTileData(
  inputs: FrameInputs,
  coord: Coord,
  queuedMovesMap: Map<string, Set<Direction>>,
): TileData {
  const board = inputs.source.board!;
  const square = Board.getSquare(board, coord);
  const coordKey = serializeCoord(coord);

  const isVisible =
    inputs.derived.allVisible || inputs.derived.visibleSquares.has(coordKey);

  const neighborVisTop =
    coord.y > 0 &&
    (inputs.derived.allVisible ||
      inputs.derived.visibleSquares.has(serializeCoord({ x: coord.x, y: coord.y - 1 })));

  const neighborVisLeft =
    coord.x > 0 &&
    (inputs.derived.allVisible ||
      inputs.derived.visibleSquares.has(serializeCoord({ x: coord.x - 1, y: coord.y })));

  const isSelected =
    inputs.ui.selectedTile !== null &&
    inputs.ui.selectedTile.x === coord.x &&
    inputs.ui.selectedTile.y === coord.y;

  const isSelectable =
    !isSelected && inputs.source.status !== 'ended' && isPlayerSquare(square);

  const isValidMove =
    inputs.ui.selectedTile !== null &&
    isAdjacentTo(inputs.ui.selectedTile, coord) &&
    !isMountainSquare(square);

  const hasTopBorder = isVisible || neighborVisTop;
  const hasLeftBorder = isVisible || neighborVisLeft;

  const queuedDirections = queuedMovesMap.get(coordKey) ?? EMPTY_DIRECTIONS;

  const playerIndex = isPlayerSquare(square) ? square.playerIndex : -1;
  const armyCount = isPlayerSquare(square) ? square.units : 0;

  return {
    coord,
    type: square.type,
    playerIndex,
    armyCount,
    isVisible,
    neighborVisTop,
    neighborVisLeft,
    isSelected,
    isSelectable,
    isValidMove,
    hasTopBorder,
    hasLeftBorder,
    queuedDirections,
  };
}

function tilesEqual(a: TileData, b: TileData): boolean {
  return (
    a.type === b.type &&
    a.playerIndex === b.playerIndex &&
    a.armyCount === b.armyCount &&
    a.isVisible === b.isVisible &&
    a.neighborVisTop === b.neighborVisTop &&
    a.neighborVisLeft === b.neighborVisLeft &&
    a.isSelected === b.isSelected &&
    a.isSelectable === b.isSelectable &&
    a.isValidMove === b.isValidMove &&
    a.hasTopBorder === b.hasTopBorder &&
    a.hasLeftBorder === b.hasLeftBorder &&
    a.queuedDirections === b.queuedDirections
  );
}

function toTileRendererProps(tile: TileData): Omit<TileRendererProps, 'onClick'> {
  const square =
    tile.playerIndex >= 0
      ? ({
          coord: tile.coord,
          type: tile.type as PlayerSquareType,
          playerIndex: tile.playerIndex,
          units: tile.armyCount,
        } satisfies PlayerSquare)
      : ({
          coord: tile.coord,
          type: tile.type as NeutralSquareType,
        } satisfies NeutralSquare);

  return {
    coord: tile.coord,
    square,
    isVisible: tile.isVisible,
    hasTopBorder: tile.hasTopBorder,
    hasLeftBorder: tile.hasLeftBorder,
    isSelected: tile.isSelected,
    isSelectable: tile.isSelectable,
    isValidMove: tile.isValidMove,
    queuedDirections: tile.queuedDirections.size > 0 ? tile.queuedDirections : undefined,
  };
}

export { EMPTY_DIRECTIONS, computeTileData, tilesEqual, toTileRendererProps };

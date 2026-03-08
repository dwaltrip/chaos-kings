import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import { Direction, NeutralSquareType, PlayerSquareType } from '@core/types';
import type { Coord, NeutralSquare, PlayerSquare } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import type { TileRendererProps } from '@/domains/gameplay/ui/tile-renderer';

import {
  getNeighborVis,
  getIsVisible,
  getIsSelected,
  getIsSelectable,
  getIsValidMove,
  getBorders,
} from './tile-derived-state';
import type { FrameInputs, TileData } from './types';

interface QueuedDirs {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
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
    a.queuedUp === b.queuedUp &&
    a.queuedDown === b.queuedDown &&
    a.queuedLeft === b.queuedLeft &&
    a.queuedRight === b.queuedRight
  );
}

function toQueuedDirectionsSet(tile: TileData): Set<Direction> | undefined {
  if (!tile.queuedUp && !tile.queuedDown && !tile.queuedLeft && !tile.queuedRight) {
    return undefined;
  }
  const dirs = new Set<Direction>();
  if (tile.queuedUp) dirs.add(Direction.UP);
  if (tile.queuedDown) dirs.add(Direction.DOWN);
  if (tile.queuedLeft) dirs.add(Direction.LEFT);
  if (tile.queuedRight) dirs.add(Direction.RIGHT);
  return dirs;
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
    queuedDirections: toQueuedDirectionsSet(tile),
  };
}

export type { QueuedDirs };
export { computeTileData, tilesEqual, toTileRendererProps };

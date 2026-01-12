import React, { useMemo } from 'react';

import type { Coord, Direction } from '@core/types';
import { Board } from '@core/board';
import { serializeCoord, areCoordsEqual } from '@core/utils/coordinate-utils';
import { isMountainSquare } from '@core/square';

import { TileRenderer } from '@/domains/gameplay/ui/tile-renderer';
import {
  usePuzzleStore,
  selectBoard,
  selectSelectedTile,
  selectMoveQueue,
  selectStatus,
  selectActions,
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
    const board = usePuzzleStore(selectBoard);
    const selectedTile = usePuzzleStore(selectSelectedTile);
    const moveQueue = usePuzzleStore(selectMoveQueue);
    const status = usePuzzleStore(selectStatus);
    const { setSelectedTile } = usePuzzleStore(selectActions);

    if (!board) return null;

    const square = Board.getSquare(board, coord);
    const isSelected = selectedTile ? areCoordsEqual(coord, selectedTile) : false;
    const isMountain = isMountainSquare(square);
    const isPuzzleEnded = status === 'ended';

    // Calculate visibility (player 0 is always the puzzle player)
    const visibleSquares = useMemo(() => {
      if (!board) return new Set<string>();
      // If puzzle ended, everything is visible
      if (isPuzzleEnded) {
        const allVisible = new Set<string>();
        Board.forEachCoord(board, (c) => allVisible.add(serializeCoord(c)));
        return allVisible;
      }
      return Board.getVisibleSquares(board, 0);
    }, [board, isPuzzleEnded]);

    const coordKey = serializeCoord(coord);
    const isVisible = visibleSquares.has(coordKey);

    // Check neighbor visibility for borders
    const hasTopBorder =
      isVisible ||
      (coord.y > 0 && visibleSquares.has(serializeCoord({ x: coord.x, y: coord.y - 1 })));
    const hasLeftBorder =
      isVisible ||
      (coord.x > 0 && visibleSquares.has(serializeCoord({ x: coord.x - 1, y: coord.y })));

    // Check if this tile is adjacent to selected (for valid move highlighting)
    const isAdjacentToSelected = useMemo(() => {
      if (!selectedTile) return false;
      const dx = Math.abs(coord.x - selectedTile.x);
      const dy = Math.abs(coord.y - selectedTile.y);
      return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    }, [selectedTile, coord]);

    // Get queued directions for this tile
    const queuedDirections = useMemo(() => {
      const dirs = new Set<Direction>();
      for (const move of moveQueue) {
        if (areCoordsEqual(move.sourceCoord, coord)) {
          dirs.add(move.direction);
        }
      }
      return dirs;
    }, [moveQueue, coord]);

    const isSelectable = !isPuzzleEnded && !isMountain && !isSelected;
    const isValidMove = isAdjacentToSelected && !isMountain;

    const handleClick = () => {
      if (isPuzzleEnded) return;

      // If clicking a valid move target, queue the move
      if (selectedTile && isValidMove) {
        const direction = getDirection(selectedTile, coord);
        if (direction) {
          queueMove(selectedTile, direction);
          setSelectedTile(null);
          return;
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

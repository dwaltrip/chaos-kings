import { useMemo } from 'react';
import type { BoardState, Coord } from '@core/types';
import { Board } from '@core/board';

interface TileVisibilityData {
  visibleNeighborCount: number;
  hiddenNeighborCount: number;
  explorationValue: 'high' | 'medium' | 'low' | 'none';
  isOnVisibilityEdge: boolean;
}

interface UseTileNeighborVisibilityParams {
  boardState: BoardState | null;
  visibleSquares: Set<Coord>;
  currentPlayerIndex: number | null;
}

export function useTileNeighborVisibility({
  boardState,
  visibleSquares,
  currentPlayerIndex,
}: UseTileNeighborVisibilityParams): Map<string, TileVisibilityData> {
  return useMemo(() => {
    const tileData = new Map<string, TileVisibilityData>();

    if (!boardState || currentPlayerIndex === null) {
      return tileData;
    }

    // Helper function to check if a coord is visible
    const isCoordVisible = (coord: Coord): boolean => {
      return Array.from(visibleSquares).some(
        (visibleCoord) =>
          visibleCoord.x === coord.x && visibleCoord.y === coord.y,
      );
    };

    // Get all 8 neighboring directions (same as Board.getVisibleSquares)
    const directions = [
      { x: -1, y: -1 }, // NW
      { x: 0, y: -1 }, // N
      { x: 1, y: -1 }, // NE
      { x: -1, y: 0 }, // W
      { x: 1, y: 0 }, // E
      { x: -1, y: 1 }, // SW
      { x: 0, y: 1 }, // S
      { x: 1, y: 1 }, // SE
    ];

    // Process each tile in the board
    boardState.grid.flat().forEach((square) => {
      const coord = square.coord;
      const coordKey = `${coord.x},${coord.y}`;

      let visibleNeighborCount = 0;
      let hiddenNeighborCount = 0;

      // Check each neighbor
      directions.forEach((direction) => {
        const neighborCoord: Coord = {
          x: coord.x + direction.x,
          y: coord.y + direction.y,
        };

        // Only count neighbors that are within board bounds
        if (Board.isCoordValid(boardState, neighborCoord)) {
          if (isCoordVisible(neighborCoord)) {
            visibleNeighborCount++;
          } else {
            hiddenNeighborCount++;
          }
        }
      });

      // Calculate derived values
      const isOnVisibilityEdge =
        visibleNeighborCount > 0 && hiddenNeighborCount > 0;

      // Exploration value based on how much unknown territory is nearby
      let explorationValue: 'high' | 'medium' | 'low' | 'none';
      if (hiddenNeighborCount === 0) {
        explorationValue = 'none';
      } else if (hiddenNeighborCount >= 6) {
        explorationValue = 'high';
      } else if (hiddenNeighborCount >= 3) {
        explorationValue = 'medium';
      } else {
        explorationValue = 'low';
      }

      tileData.set(coordKey, {
        visibleNeighborCount,
        hiddenNeighborCount,
        explorationValue,
        isOnVisibilityEdge,
      });
    });

    return tileData;
  }, [boardState, visibleSquares, currentPlayerIndex]);
}

export type { TileVisibilityData };

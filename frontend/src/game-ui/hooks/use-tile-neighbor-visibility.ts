import { useMemo } from 'react';
import type { BoardState, Coord } from '@core/types';

interface TileVisibilityData {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

interface UseTileNeighborVisibilityParams {
  boardState: BoardState;
  visibleSquares: Set<Coord>;
  currentPlayerIndex: number;
}

type GetTileNeighborVisibility = (coord: Coord) => TileVisibilityData;

function useTileNeighborVisibility({
  boardState,
  visibleSquares,
  currentPlayerIndex,
}: UseTileNeighborVisibilityParams): GetTileNeighborVisibility {
  return useMemo(() => {
    const tileData = new Map<string, TileVisibilityData>();

    // Helper function to check if a coord is visible
    const isCoordVisible = (coord: Coord): boolean => {
      return visibleSquares.has(coord);
    };

    // Process each tile in the board
    boardState.grid.flat().forEach((square) => {
      const coord = square.coord;
      const coordKey = `${coord.x},${coord.y}`;

      tileData.set(coordKey, {
        top: isCoordVisible({ x: coord.x, y: coord.y - 1 }),
        bottom: isCoordVisible({ x: coord.x, y: coord.y + 1 }),
        left: isCoordVisible({ x: coord.x - 1, y: coord.y }),
        right: isCoordVisible({ x: coord.x + 1, y: coord.y }),
      });
    });

    return function getTileNeighborVisibility(
      coord: Coord,
    ): TileVisibilityData {
      const neighborVisibilityInfo = tileData.get(`${coord.x},${coord.y}`);
      if (!neighborVisibilityInfo) {
        throw new Error('Unexpected error in useTileNeighborVisibility');
      }
      return neighborVisibilityInfo;
    };
  }, [boardState, visibleSquares, currentPlayerIndex]);
}

export type { TileVisibilityData };
export { useTileNeighborVisibility };

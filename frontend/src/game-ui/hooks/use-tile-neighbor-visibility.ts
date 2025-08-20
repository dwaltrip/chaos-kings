import { useMemo } from 'react';
import { GameStatus, type GameStatusType } from '@common/types/games';
import type { BoardState, Coord } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

interface TileVisibilityData {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

interface UseTileNeighborVisibilityParams {
  boardState: BoardState;
  visibleSquares: Set<string>;
  currentPlayerIndex: number;
  gameStatus: GameStatusType;
}

type GetTileNeighborVisibility = (coord: Coord) => TileVisibilityData;

function useTileNeighborVisibility({
  boardState,
  visibleSquares,
  currentPlayerIndex,
  gameStatus,
}: UseTileNeighborVisibilityParams): GetTileNeighborVisibility {
  return useMemo(() => {
    const everythingVisible = {
      top: true,
      bottom: true,
      left: true,
      right: true,
    };
    if (gameStatus === GameStatus.COMPLETE) {
      return (_: Coord) => everythingVisible;
    }

    const tileData = new Map<string, TileVisibilityData>();

    // Helper function to check if a coord is visible
    const isCoordVisible = (coord: Coord): boolean => {
      return visibleSquares.has(serializeCoord(coord));
    };

    // Process each tile in the board
    boardState.grid.flat().forEach((square) => {
      const coord = square.coord;
      const coordKey = serializeCoord(coord);

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
      const neighborVisibilityInfo = tileData.get(serializeCoord(coord));
      if (!neighborVisibilityInfo) {
        throw new Error('Unexpected error in useTileNeighborVisibility');
      }
      return neighborVisibilityInfo;
    };
  }, [boardState, visibleSquares, currentPlayerIndex]);
}

export type { TileVisibilityData };
export { useTileNeighborVisibility };

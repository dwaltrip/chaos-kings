import { useMemo } from 'react';
import type { Coord, Square } from '@core/types';
import { isGeneralSquare, isMountainSquare } from '@core/square';
import { isSquareVisible } from '@/game-ui/utils/visibility-utils';
import { isEnded } from '@core/game';
import {
  computeNeighborVisibility,
  computeTileBorders,
  isAdjacentTo,
  type NeighborVisibility,
  type BorderData,
} from '@/game-ui/utils/tile-utils';
import {
  useBoardState,
  useGameplayState,
} from '@/game-ui/hooks/use-gameplay-state';
import { useFogOfWar } from '@/game-ui/hooks/use-fog-of-war';
import { useCurrentPlayerIndex } from '@/stores/game-metadata-store';

interface TileState {
  square: Square;
  isSelected: boolean;
  isSelectable: boolean;
  isNeighborOfSelected: boolean;
  isVisible: boolean;
  isGeneral: boolean;
  neighborVisibility: NeighborVisibility;
  borders: BorderData;
}

function useTileState(coord: Coord): TileState {
  const boardState = useBoardState();
  const { selectedTile, game } = useGameplayState(null);
  const currentPlayerIndex = useCurrentPlayerIndex();
  const { visibleSquares } = useFogOfWar({ boardState, currentPlayerIndex });

  return useMemo(() => {
    if (!boardState || !game) {
      throw new Error('Board state or game not available');
    }

    const square = boardState.grid[coord.y][coord.x];
    const isMountain = isMountainSquare(square);

    // ---------------------------------
    // TODO [__FIX_TILE_SELECTION__]
    // --------------------------------
    // const isSelected = selectedTile ? areCoordsEqual(selectedTile, coord) : false;
    const isSelected = false;
    const isSelectable = !isEnded(game) && !(isMountain || isSelected);

    const isNeighborOfSelected = selectedTile
      ? isAdjacentTo(selectedTile, coord)
      : false;
    const isVisible =
      isEnded(game) ||
      isSquareVisible(coord, visibleSquares, currentPlayerIndex);
    const isGeneral = isGeneralSquare(square);

    const neighborVisibility = isEnded(game)
      ? {
          top: true,
          bottom: true,
          left: true,
          right: true,
        }
      : computeNeighborVisibility(coord, visibleSquares);
    const borders = computeTileBorders(coord, neighborVisibility, isVisible);

    return {
      square,
      isSelected,
      isSelectable,
      isNeighborOfSelected,
      isVisible,
      isGeneral,
      neighborVisibility,
      borders,
    };
  }, [
    coord,
    selectedTile,
    boardState,
    game,
    visibleSquares,
    currentPlayerIndex,
  ]);
}

export type { TileState };
export { useTileState };

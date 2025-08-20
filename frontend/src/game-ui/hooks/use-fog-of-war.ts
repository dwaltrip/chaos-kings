import { useMemo } from 'react';
import type { BoardState, Coord } from '@core/types';
import { Board } from '@core/board';

interface UseFogOfWarParams {
  boardState: BoardState | null;
  currentPlayerIndex: number | null;
}

interface FogOfWarResult {
  visibleSquares: Set<Coord>;
}

export function useFogOfWar({
  boardState,
  currentPlayerIndex,
}: UseFogOfWarParams): FogOfWarResult {
  const visibleSquares = useMemo(() => {
    if (!boardState || currentPlayerIndex === null) return new Set<Coord>();
    return Board.getVisibleSquares(boardState, currentPlayerIndex);
  }, [boardState, currentPlayerIndex]);

  return { visibleSquares };
}

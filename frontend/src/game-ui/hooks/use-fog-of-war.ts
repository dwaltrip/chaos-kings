import { useMemo } from 'react';
import type { BoardState } from '@core/types';
import { Board } from '@core/board';

interface UseFogOfWarParams {
  boardState: BoardState | null;
  currentPlayerIndex: number | null;
}

interface FogOfWarResult {
  visibleSquares: Set<string>;
}

export function useFogOfWar({
  boardState,
  currentPlayerIndex,
}: UseFogOfWarParams): FogOfWarResult {
  const visibleSquares = useMemo(() => {
    if (!boardState || currentPlayerIndex === null) return new Set<string>();
    return Board.getVisibleSquares(boardState, currentPlayerIndex);
  }, [boardState, currentPlayerIndex]);

  return { visibleSquares };
}

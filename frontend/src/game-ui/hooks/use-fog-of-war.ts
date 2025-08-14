import { useMemo } from 'react';
import type { BoardState, Coord } from '@core/types';
import { Board } from '@core/board';

interface UseFogOfWarParams {
  boardState: BoardState | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
  user: { id: number } | null;
  gameId: number | null;
}

interface FogOfWarResult {
  currentPlayerIndex: number | null;
  visibleSquares: Set<Coord>;
}

export function useFogOfWar({
  boardState,
  playerMapping,
  user,
  gameId,
}: UseFogOfWarParams): FogOfWarResult {
  const currentPlayerIndex = useMemo(() => {
    if (!user) {
      console.log('[DEBUG useFogOfWar] No user');
      return null;
    }

    // First try to get from active gameplay playerMapping
    if (playerMapping) {
      console.log('[DEBUG useFogOfWar] Checking playerMapping', {
        playerMapping,
        userId: user.id,
      });
      const mapping = playerMapping.find(
        (p) => p.playerId === user.id.toString(),
      );
      if (mapping) {
        console.log(
          '[DEBUG useFogOfWar] Found mapping from playerMapping',
          mapping,
        );
        return mapping.playerIndex;
      }
    }

    // Note: Removed game.players fallback since GameUI is now autonomous
    // and should rely only on playerMapping from active gameplay state

    console.log('[DEBUG useFogOfWar] No mapping found');
    return null;
  }, [user, playerMapping, gameId]);

  const visibleSquares = useMemo(() => {
    if (!boardState || currentPlayerIndex === null) return new Set<Coord>();
    return Board.getVisibleSquares(boardState, currentPlayerIndex);
  }, [boardState, currentPlayerIndex]);

  return { currentPlayerIndex, visibleSquares };
}

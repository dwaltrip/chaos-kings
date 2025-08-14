import { useMemo } from 'react';
import type { BoardState, Coord } from '@core/types';
import type { GameWithPlayers } from '@common/types/games';
import { Board } from '@core/board';

interface UseFogOfWarParams {
  boardState: BoardState | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
  user: { id: number } | null;
  game: GameWithPlayers | null;
}

interface FogOfWarResult {
  currentPlayerIndex: number | null;
  visibleSquares: Set<Coord>;
}

export function useFogOfWar({ boardState, playerMapping, user, game }: UseFogOfWarParams): FogOfWarResult {
  const currentPlayerIndex = useMemo(() => {
    if (!user) {
      console.log('[DEBUG useFogOfWar] No user');
      return null;
    }
    
    // First try to get from active gameplay playerMapping
    if (playerMapping) {
      console.log('[DEBUG useFogOfWar] Checking playerMapping', { playerMapping, userId: user.id });
      const mapping = playerMapping.find(p => p.playerId === user.id.toString());
      if (mapping) {
        console.log('[DEBUG useFogOfWar] Found mapping from playerMapping', mapping);
        return mapping.playerIndex;
      }
    }
    
    // Fallback: try to determine from game.players if game is not actively started
    if (game?.players) {
      console.log('[DEBUG useFogOfWar] Checking game.players', { players: game.players, userId: user.id });
      const playerIndex = game.players.findIndex(p => p.player_id === user.id);
      if (playerIndex >= 0) {
        console.log('[DEBUG useFogOfWar] Found mapping from game.players', { playerIndex });
        return playerIndex;
      }
    }
    
    console.log('[DEBUG useFogOfWar] No mapping found');
    return null;
  }, [user, playerMapping, game]);

  const visibleSquares = useMemo(() => {
    if (!boardState || currentPlayerIndex === null) return new Set<Coord>();
    return Board.getVisibleSquares(boardState, currentPlayerIndex);
  }, [boardState, currentPlayerIndex]);

  return { currentPlayerIndex, visibleSquares };
}
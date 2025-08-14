import { useCallback } from 'react';
import type { Coord, Movement } from '@core/types';
import { getWebSocketService } from '@/services/websocket-service';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import { gameplayStore } from '@/pages/game/gameplay/gameplay-store';

export function useGameplay() {
  const { actions } = gameplayStore.getState();

  const handleTileSelect = useCallback((coord: Coord) => {
    actions.setSelectedTile(coord);
  }, [actions]);

  const handleMoveRequest = useCallback((direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', selectedTile: Coord | null) => {
    if (!selectedTile) {
      console.warn('Cannot move: no tile selected');
      return;
    }
    
    // Follow the army to its destination
    actions.followArmyMovement(selectedTile, direction as Movement);
    
    const wsService = getWebSocketService();
    wsService.send({
      domain: GAMEPLAY_DOMAIN,
      type: 'move-request',
      payload: {
        sourceCoord: selectedTile,
        direction: direction as Movement
      }
    });
  }, [actions]);

  const handleCancelMoves = useCallback(() => {
    const wsService = getWebSocketService();
    wsService.send({
      domain: GAMEPLAY_DOMAIN,
      type: 'cancel-moves-request',
      payload: null
    });
  }, []);

  return {
    handleTileSelect,
    handleMoveRequest,
    handleCancelMoves,
  };
}
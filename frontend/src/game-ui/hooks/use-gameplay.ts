import { useCallback } from 'react';
import { type Coord } from '@core/types';
import { Board } from '@core/board';
import { getWebSocketService } from '@/services/websocket-service';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import { gameplayStore } from '@/game-ui/store/gameplay-store';
import { getCurrentPlayerIndex } from '@/stores/game-metadata-store';
import { gameMetadataStore } from '@/stores/game-metadata-store';
import { userStore } from '@/stores/user-store';

export function useGameplay() {
  const { actions } = gameplayStore.getState();

  const handleMoveRequest = useCallback(
    (
      direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
      selectedTile: Coord | null,
    ) => {
      if (!selectedTile) {
        console.warn('Cannot move: no tile selected');
        return;
      }

      // Get current game state for validation
      const state = gameplayStore.getState();
      const { boardState } = state;

      if (!boardState) {
        console.warn('Cannot move: no board state available');
        return;
      }

      // Get current player index for validation
      const game = gameMetadataStore.getState().game;
      const user = userStore.getState().user;
      const currentPlayerIndex = getCurrentPlayerIndex(game, user?.id ?? null);

      if (currentPlayerIndex === null) {
        console.warn('Cannot move: unable to determine current player');
        return;
      }

      // Basic client-side validation / movement UX
      // Can't queue off the map or into mountains
      if (!Board.canMove(boardState, selectedTile, direction)) {
        return;
      }

      // Immediately add to local queue for instant arrow feedback
      actions.addQueuedMove(selectedTile, direction);

      // Follow the army to its destination
      actions.followArmyMovement(selectedTile, direction);

      // Send to server
      const wsService = getWebSocketService();
      wsService.send({
        domain: GAMEPLAY_DOMAIN,
        type: 'move-request',
        payload: {
          sourceCoord: selectedTile,
          direction,
        },
      });
    },
    [actions],
  );

  const handleCancelMoves = useCallback(() => {
    const wsService = getWebSocketService();
    wsService.send({
      domain: GAMEPLAY_DOMAIN,
      type: 'cancel-moves-request',
      payload: null,
    });
  }, []);

  return {
    handleMoveRequest,
    handleCancelMoves,
  };
}

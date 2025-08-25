import type { WsDomainHandler, WsMessage } from '@common/types/websockets';
import type { GameMatchmakingMessageType } from '@common/types/game-matchmaking';
import { gameMatchmakingStore } from '@/pages/join-game/join-game-store';
import { NAVIGATION_DELAY_MS } from '@core/ui-timing-config';

const { actions } = gameMatchmakingStore.getState();

const GameMatchmakingWsHandler: WsDomainHandler = {
  handleMessage: (data: WsMessage) => {
    const { type, payload } = data;

    switch (type as GameMatchmakingMessageType) {
      // TODO: this is only client -> server, need to fix the typing and remove this case.
      case 'join-queue':
        console.log('join-queue message received');
        break;
      // TODO: this is only client -> server, need to fix the typing and remove this case.
      case 'leave-queue':
        console.log('leave-queue message received');
        break;
      case 'queue-status':
        console.log('queue-status message received:', payload);
        if (
          payload &&
          typeof payload === 'object' &&
          'queueSize' in payload &&
          'playersNeeded' in payload
        ) {
          actions.setQueueSize(payload.queueSize as number);
          actions.setPlayersNeeded(payload.playersNeeded as number);
        }
        break;
      case 'game-ready':
        console.log('game-ready message received:', payload);
        if (payload && typeof payload === 'object' && 'gameId' in payload) {
          const gameId = payload.gameId as number;
          console.log('Game ready! GameId:', gameId);

          // Set game ready state (for UI feedback)
          actions.setGameReady(gameId);

          // Navigate to game page after navigation delay
          setTimeout(() => {
            console.log(`Navigating to game ${gameId}...`);
            window.location.href = `/games/${gameId}`;
          }, NAVIGATION_DELAY_MS);
        }
        break;
      default:
        console.error(`[game-matchmaking] Unknown message type: ${type}`);
        break;
    }
  },
};

export { GameMatchmakingWsHandler };

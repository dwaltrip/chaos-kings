import type { WsMessage } from '@common/types/websockets';
import type { GameMatchmakingMessageType } from '@common/types/game-matchmaking';
import { gameMatchmakingStore } from '@/pages/join-game/join-game-store';

const { actions } = gameMatchmakingStore.getState();

let countdownInterval: NodeJS.Timeout | null = null;

const GameMatchmakingWsHandler = {
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

          // Set game ready state and start countdown
          actions.setGameReady(gameId);

          // Clear any existing countdown
          if (countdownInterval) {
            clearInterval(countdownInterval);
          }

          // Start 5-second countdown
          countdownInterval = setInterval(() => {
            const currentState = gameMatchmakingStore.getState();
            const newCountdown = currentState.countdown - 1;

            if (newCountdown <= 0) {
              // Navigate to game page
              if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
              }

              // Navigate to game
              window.location.href = `/games/${gameId}`;
            } else {
              actions.setCountdown(newCountdown);
            }
          }, 1000);
        }
        break;
      default:
        console.error(`[game-matchmaking] Unknown message type: ${type}`);
        break;
    }
  },
};

export { GameMatchmakingWsHandler };

import type { WsMessage } from '@common/types/websockets';
import type { GameMatchmakingMessageType } from '@common/types/game-matchmaking';
import { gameMatchmakingStore } from '@/pages/join-game/join-game-store';

const { actions } = gameMatchmakingStore.getState();

const GameMatchmakingWsHandler = {
  handleMessage: (data: WsMessage) => { 
    const { type } = data;

    switch (type as GameMatchmakingMessageType) {
      case 'join-queue':
        console.log('join-queue message received');
        // handle join queue
      case 'leave-queue':
        console.log('leave-queue message received');
        // handle leave queue
      case 'queue-status':
        console.log('queue-status message received');
        // handle queue status
      case 'game-ready':
        console.log('game-ready message received');
        // handle game ready
      default:
        console.error(`[game-chat] Unknown message type: ${type}`);
    }
  }
}

export { GameMatchmakingWsHandler };

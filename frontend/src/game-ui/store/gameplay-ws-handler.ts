import type { WsMessage } from '@common/types/websockets';
import type { GameplayMessageType, Gameplay } from '@common/types/gameplay';
import { gameplayStore } from '@/game-ui/store/gameplay-store';

const { actions } = gameplayStore.getState();

const GameplayWsHandler = {
  handleMessage: (data: WsMessage) => {
    const { type } = data;

    switch (type as GameplayMessageType) {
      case 'game-started':
        const gameStartedPayload =
          data.payload as Gameplay.GameStarted['payload'];
        actions.setGameId(gameStartedPayload.gameId);
        actions.setPlayerMapping(gameStartedPayload.playerMapping);
        actions.setBoardState(gameStartedPayload.boardState);
        console.log('[gameplay] Game started:', gameStartedPayload);
        break;

      case 'game-state-update':
        const updatePayload =
          data.payload as Gameplay.GameStateUpdate['payload'];
        actions.setBoardState(updatePayload.boardState);
        actions.setTick(updatePayload.tick);
        break;

      case 'game-ended':
        const endedPayload = data.payload as Gameplay.GameEnded['payload'];
        actions.setBoardState(endedPayload.finalBoardState);
        actions.setGameEnded(endedPayload.winner, endedPayload.reason);
        console.log('[gameplay] Game ended:', endedPayload);
        break;

      default:
        console.error(`[gameplay] Unknown message type: ${type}`);
    }
  },
};

export { GameplayWsHandler };

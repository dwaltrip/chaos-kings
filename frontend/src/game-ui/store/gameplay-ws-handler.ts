import type { WsMessage } from '@common/types/websockets';
import type { GameplayMessageType, Gameplay } from '@common/types/gameplay';

import { updateForGameStarting } from '@/game-ui/actions/update-for-game-starting';
import { updateForGameStart } from '@/game-ui/actions/update-for-game-start';
import { updateGameplayState } from '@/game-ui/actions/update-gameplay-state';
import { updateForGameEnded } from '@/game-ui/actions/update-for-game-ended';

const GameplayWsHandler = {
  handleMessage: (data: WsMessage) => {
    const { type } = data;

    switch (type as GameplayMessageType) {
      case 'game-starting':
        const gameStartingPayload =
          data.payload as Gameplay.GameStarting['payload'];
        updateForGameStarting(gameStartingPayload.countdown);
        console.log(
          '[gameplay-ws-handler] Game starting update (countdown seconds)',
        );
        break;

      case 'game-started':
        const gameStartedPayload =
          data.payload as Gameplay.GameStarted['payload'];
        console.log('[gameplay-ws-handler] Game started');
        updateForGameStart(
          gameStartedPayload.game,
          gameStartedPayload.boardState,
          gameStartedPayload.playerMapping,
        );
        break;

      case 'game-state-update':
        const { boardState, tick, playerQueues } =
          data.payload as Gameplay.GameStateUpdate['payload'];
        updateGameplayState(tick, boardState, playerQueues || {});
        break;

      case 'game-ended':
        const { finalBoardState, winner } =
          data.payload as Gameplay.GameEnded['payload'];
        updateForGameEnded(finalBoardState, winner);
        console.log('[gameplay-ws-handler] Game ended');
        break;

      default:
        console.error(`[gameplay] Unknown message type: ${type}`);
    }
  },
};

export { GameplayWsHandler };

import type { WsServerOutbound } from '@common/types/websockets';
import type { GameplayServerMessageType, GameplayServer } from '@common/types/gameplay';

import { updateForGameStarting } from '@/game-ui/actions/update-for-game-starting';
import { updateForGameStart } from '@/game-ui/actions/update-for-game-start';
import { updateGameplayState } from '@/game-ui/actions/update-gameplay-state';
import { updateForGameEnded } from '@/game-ui/actions/update-for-game-ended';

const GameplayWsHandler = {
  handleMessage: (data: WsServerOutbound) => {
    const { type } = data;

    switch (type as GameplayServerMessageType) {
      case 'game-starting':
        const gameStartingPayload =
          data.payload as GameplayServer.GameStarting['payload'];
        updateForGameStarting(gameStartingPayload.countdown);
        console.log('[gameplay-ws-handler] Game starting update (countdown seconds)');
        break;

      case 'game-started':
        const gameStartedPayload = data.payload as GameplayServer.GameStarted['payload'];
        console.log('[gameplay-ws-handler] Game started');
        updateForGameStart(
          gameStartedPayload.game,
          gameStartedPayload.boardState,
          gameStartedPayload.playerMapping,
        );
        break;

      case 'game-state-update':
        const { boardState, tick, playerQueues } =
          data.payload as GameplayServer.GameStateUpdate['payload'];
        updateGameplayState(tick, boardState, playerQueues || {});
        break;

      case 'game-ended':
        const { finalBoardState, winner } =
          data.payload as GameplayServer.GameEnded['payload'];
        updateForGameEnded(finalBoardState, winner);
        console.log('[gameplay-ws-handler] Game ended');
        break;

      default:
        console.error(`[gameplay] Unknown message type: ${type}`);
    }
  },
};

export { GameplayWsHandler };

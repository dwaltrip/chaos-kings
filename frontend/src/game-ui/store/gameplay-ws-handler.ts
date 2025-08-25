import type { WsMessage } from '@common/types/websockets';
import type { GameplayMessageType, Gameplay } from '@common/types/gameplay';
import { GameStatus } from '@common/types/games';
import { gameplayStore } from '@/game-ui/store/gameplay-store';
import { gameMetadataStore } from '@/stores/game-metadata-store';
import { getCurrentPlayerIndex } from '@/stores/game-metadata-store';
import { userStore } from '@/stores/user-store';

const { actions } = gameplayStore.getState();

const GameplayWsHandler = {
  handleMessage: (data: WsMessage) => {
    const { type } = data;

    switch (type as GameplayMessageType) {
      case 'game-starting':
        const gameStartingPayload =
          data.payload as Gameplay.GameStarting['payload'];
        const metadataActions = gameMetadataStore.getState().actions;
        metadataActions.setCountdownActive(true);
        metadataActions.setCountdownSeconds(gameStartingPayload.countdown);
        console.log('[gameplay] Game countdown:', gameStartingPayload);
        break;

      case 'game-started':
        const gameStartedPayload =
          data.payload as Gameplay.GameStarted['payload'];
        // Stop countdown when game actually starts
        const metadataActionsStarted = gameMetadataStore.getState().actions;
        metadataActionsStarted.setCountdownActive(false);

        // Update entire game object if provided by backend
        if (gameStartedPayload.game) {
          metadataActionsStarted.setGame(gameStartedPayload.game);
          console.log(
            '[gameplay] Updated game object from backend:',
            gameStartedPayload.game,
          );
        } else {
          // Fallback: manually update status if no game object provided
          metadataActionsStarted.updateGame({
            status: GameStatus.IN_PROGRESS,
            updated_at: new Date().toISOString(),
          });
          console.log('[gameplay] Fallback: manually updated game status');
        }

        // Initialize gameplay state
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

        // Handle queue updates
        if (updatePayload.playerQueues) {
          const game = gameMetadataStore.getState().game;
          const user = userStore.getState().user;
          const currentPlayerIndex = getCurrentPlayerIndex(
            game,
            user?.id ?? null,
          );
          const myQueue =
            currentPlayerIndex !== null
              ? updatePayload.playerQueues[currentPlayerIndex] || []
              : [];
          actions.setQueuedMoves(myQueue);
        }
        break;

      case 'game-ended':
        const endedPayload = data.payload as Gameplay.GameEnded['payload'];
        // Update game status to complete and timestamp
        const metadataActionsEnded = gameMetadataStore.getState().actions;
        metadataActionsEnded.updateGame({
          status: GameStatus.COMPLETE,
          updated_at: new Date().toISOString(),
        });
        actions.setBoardState(endedPayload.finalBoardState);
        actions.setGameEnded(endedPayload.winner, endedPayload.reason);
        actions.setSelectedTile(null);
        console.log('[gameplay] Game ended:', endedPayload);
        break;

      default:
        console.error(`[gameplay] Unknown message type: ${type}`);
    }
  },
};

export { GameplayWsHandler };

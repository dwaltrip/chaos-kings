import type { BoardState } from '@core/types';
import type { PlayerIndex } from '@common/types/player';
import { GameStatus } from '@common/types/games';

import { gameMetadataStore } from '@/stores/game-metadata-store';
import { useGameplayStoreV2 } from '@/game-ui/store/gameplay-store-v2';

const { updateGame } = gameMetadataStore.getState().actions;

const { updateBoard, setWinner, setVisibleSquares } =
  useGameplayStoreV2.getState().actions;

function updateForGameEnded(finalBoardState: BoardState, winner: PlayerIndex) {
  // -----------------------------------------------------------
  // TODO: Use data from server, dont manually set these values
  // -----------------------------------------------------------
  updateGame({
    status: GameStatus.COMPLETE,
    updated_at: new Date().toISOString(),
  });

  updateBoard(finalBoardState);
  setWinner(winner);

  // All squares visible at end of game, so we reset to empty set (slightly counterintuitive)
  setVisibleSquares(new Set<string>());
  useGameplayStoreV2.getState().actions.clearSelectedTile();
}

export { updateForGameEnded };

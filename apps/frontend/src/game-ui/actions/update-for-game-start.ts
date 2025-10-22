import type { GameWithPlayers } from '@common/types/games';
import type { BoardState } from '@core/types';
import type { PlayerIndex } from '@common/types/player';

import { gameMetadataStore } from '@/stores/game-metadata-store';
import { gameplayActions } from '@/game-ui/store/gameplay-store-v2';

const { setCountdownActive, setGame, setPlayerMapping } =
  gameMetadataStore.getState().actions;

type UserToPlayerMapping = {
  playerId: string; // TODO: rename to userId.
  playerIndex: PlayerIndex;
};

// TODO: set visible squares here also?
function updateForGameStart(
  game: GameWithPlayers,
  boardState: BoardState,
  mapping: UserToPlayerMapping[],
) {
  const { updateBoard } = gameplayActions();
  // Stop countdown when game actually starts
  setCountdownActive(false);
  // TODO: set game on gameplay store v2 also?
  setGame(game);
  updateBoard(boardState);
  // TODO: double check this, can / should we move to gameplay store v2?
  setPlayerMapping(mapping);

  // Get currentPlayerIndex for visible squares computation
  // const currentPlayerIndex = useGameplayStoreV2.getState().currentPlayerIndex();
  // TODO: update visible squares!!!!
}

export { updateForGameStart };

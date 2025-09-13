import type { BoardState, Coord, Movement } from '@core/types';
import {
  gameMetadataStore,
  getCurrentPlayerIndex,
} from '@/stores/game-metadata-store';
import { Board } from '@core/board';
import type { GameWithPlayers } from '@common/types/games';

// ---------------------------------------------------------
// TODO: User.id is a different type in @common vs this type
// Need to fix / clean up id types
// ---------------------------------------------------------
import type { User } from '@/services/user-service';
import { getWebSocketService } from '@/services/websocket-service';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import { gameplayStore } from '@/game-ui/store/gameplay-store';
import { userStore } from '@/stores/user-store';
import { useGameplayStoreV2 } from '@/game-ui/store/gameplay-store-v2';

const { actions } = gameplayStore.getState();

// TODO: temp wrapper while we refactor
// the frontend stores / actions
// on gameplay page
function queueMove(direction: Movement, selectedTile: Coord | null) {
  const state = gameplayStore.getState();
  const { boardState } = state;
  const game = gameMetadataStore.getState().game;
  const user = userStore.getState().user;
  if (!boardState || !game || !user) {
    throw Error('Missing required state for move request');
  }
  _queueMove(direction, selectedTile, boardState, game, user);
}

function _queueMove(
  direction: Movement,
  selectedTile: Coord | null,
  boardState: BoardState,
  game: GameWithPlayers,
  user: User,
) {
  if (!selectedTile) {
    console.warn('Cannot move: no tile selected');
    return;
  }

  const currentPlayerIndex = getCurrentPlayerIndex(game, user.id);
  if (currentPlayerIndex === null) {
    console.warn('Cannot move: unable to determine current player');
    return;
  }

  // This shouldn't be necessary for 2 reasons:
  // 1. The UI should prevent invalid moves
  // 2. The server will reject invalid moves anyway
  // TODO: remove it?
  if (!Board.canMove(boardState, selectedTile, direction)) {
    return;
  }

  // Immediately add to local queue for instant arrow feedback
  actions.addQueuedMove(selectedTile, direction);
  // Follow the army to its destination
  followArmyMovement(selectedTile, direction);

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
}

const {
  actions: { setSelectedTileV2 },
} = useGameplayStoreV2.getState();

function followArmyMovement(src: Coord, direction: Movement): void {
  const { boardState } = gameplayStore.getState();
  if (!boardState) {
    return;
  }
  const dest = Board.applyDirection(src, direction);

  // Only update selection if the destination is valid and the source matches current selection
  const selectedTile = useGameplayStoreV2.getState().selectedTile;
  // TODO: we don't need the entire board state to do a bounds check...
  if (
    Board.isCoordValid(boardState, dest) &&
    selectedTile &&
    selectedTile.x === src.x &&
    selectedTile.y === src.y
  ) {
    setSelectedTileV2(dest);
  }
}

export { queueMove };

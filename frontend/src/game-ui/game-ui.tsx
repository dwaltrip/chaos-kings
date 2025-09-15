import type { Direction } from '@core/types';

import { useKeyboardControls } from '@/game-ui/hooks/use-keyboard-controls';
import {
  useBoardState,
  useGameplayState,
} from '@/game-ui/hooks/use-gameplay-state';
import { GameBoard } from '@/game-ui/components/game-board';
import { queueMove } from '@/game-ui/actions/queue-move';
import { undoLastQueuedMove } from '@/game-ui/actions/undo-last-queued-move';
import { cancelQueuedMoves } from '@/game-ui/actions/cancel-queued-moves';
import {
  useGameplayStoreV2,
  useSelectedTile,
} from '@/game-ui/store/gameplay-store-v2';

import '@/game-ui/game-page.css';
import '@/game-ui/game-tile.css';
import { useCurrentPlayerIndex } from '@/stores/game-metadata-store';

interface GameUIProps {
  gameId: number | null;
}
// -----------------------------------
// TODO: remove `gameId` if not needed
// -----------------------------------
function GameUI({ gameId: _gameId }: GameUIProps) {
  const gameplayState = useGameplayState();
  const boardState = useBoardState();
  const currentPlayerIndex = useCurrentPlayerIndex();

  const selectedTile = useGameplayStoreV2(useSelectedTile);
  const game = gameplayState.game;
  const disabled = gameplayState.gameEnded;

  useKeyboardControls({
    onMoveRequest: (dir: Direction) => queueMove(dir, selectedTile),
    onUndoMove: () => undoLastQueuedMove(),
    onCancelMoves: () => cancelQueuedMoves(),
    disabled,
  });

  // const shouldShowGameBoard = boardState && game && currentPlayerIndex !== null;
  const shouldShowGameBoard = boardState && game;
  if (!shouldShowGameBoard) {
    console.log('[DEBUG GameUI] Not showing game board', {
      boardState,
      game,
      currentPlayerIndex,
    });
  }

  if (!shouldShowGameBoard) {
    return <div>Loading game...</div>;
  }

  return <GameBoard boardState={boardState} disabled={disabled} />;
}

export { GameUI };

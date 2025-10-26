import type { Direction } from '@core/types';
import { isEnded } from '@core/game';

import { useKeyboardControls } from '@/game-ui/hooks/use-keyboard-controls';
import { GameBoard } from '@/game-ui/components/game-board';
import { queueMove } from '@/game-ui/actions/queue-move';
import { undoLastQueuedMove } from '@/game-ui/actions/undo-last-queued-move';
import { cancelQueuedMoves } from '@/game-ui/actions/cancel-queued-moves';
import {
  useBoardState,
  useGameplayGame,
  useGameplayStoreV2,
  useSelectedTile,
} from '@/game-ui/store/gameplay-store-v2';

import '@/game-ui/game-page.css';
import '@/game-ui/game-tile.css';

interface GameUIProps {
  gameId: number | null;
}
// -----------------------------------
// TODO: remove `gameId` if not needed
// -----------------------------------
function GameUI({ gameId: _gameId }: GameUIProps) {
  const game = useGameplayStoreV2(useGameplayGame);
  const board = useGameplayStoreV2(useBoardState);
  const selectedTile = useGameplayStoreV2(useSelectedTile);

  // UI is only enabled if game is in progress
  const isDisabled = game ? isEnded(game) : true;

  useKeyboardControls({
    onMoveRequest: (dir: Direction) => {
      board && queueMove(dir, selectedTile, board);
    },
    onUndoMove: () => undoLastQueuedMove(),
    onCancelMoves: () => cancelQueuedMoves(),
    disabled: isDisabled,
  });

  const shouldShowGameBoard = board && game;
  if (!shouldShowGameBoard) {
    console.log('[DEBUG GameUI] Not showing game board', {
      board,
      game,
    });
  }

  if (!shouldShowGameBoard) {
    return <div>Loading game...</div>;
  }

  return <GameBoard boardState={board} disabled={isDisabled} />;
}

export { GameUI };

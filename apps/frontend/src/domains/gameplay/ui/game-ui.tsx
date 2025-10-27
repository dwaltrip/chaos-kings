import type { Direction } from '@core/types';
import { isEnded } from '@core/game';

import { useKeyboardControls } from '@/domains/gameplay/hooks/use-keyboard-controls';
import { GameBoard } from '@/domains/gameplay/ui/game-board';
import {
  useBoardState,
  useGameplayGame,
  useGameplayStoreV2,
  useSelectedTile,
} from '@/domains/gameplay/stores/gameplay-store-v2';
import {
  queueMove,
  undoLastQueuedMove,
  cancelQueuedMoves,
} from '@/domains/gameplay/actions';

import '@/domains/gameplay/ui/game-page.css';
import '@/domains/gameplay/ui/game-tile.css';

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

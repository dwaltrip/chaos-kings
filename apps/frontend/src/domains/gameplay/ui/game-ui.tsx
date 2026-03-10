import type { Direction } from '@core/types';
import { isEnded } from '@core/game';

import { boardStore } from '@/domains/games/board-store';
import { useBoardState } from '@/domains/games/board-store/hooks';
import { useKeyboardControls } from '@/domains/gameplay/hooks/use-keyboard-controls';
import { GameBoard } from '@/domains/gameplay/ui/game-board';
import {
  useGameplayGame,
  useGameplayStoreV2,
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
  const { game: boardState, ui } = useBoardState(boardStore);

  // UI is only enabled if game is in progress
  const isDisabled = game ? isEnded(game) : true;

  useKeyboardControls({
    onMoveRequest: (dir: Direction) => {
      queueMove(dir, ui.selectedTile);
    },
    onUndoMove: () => undoLastQueuedMove(),
    onCancelMoves: () => cancelQueuedMoves(),
    disabled: isDisabled,
  });

  const board = boardState.board;
  if (!board || !game) {
    console.log('[DEBUG GameUI] Not showing game board', { board, game });
    return <div>Loading game...</div>;
  }

  return <GameBoard boardState={board} disabled={isDisabled} />;
}

export { GameUI };

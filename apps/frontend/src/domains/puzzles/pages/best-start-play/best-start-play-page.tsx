import type { Direction } from '@core/types';

import {
  userStore,
  selectUser,
  selectIsLoading,
  selectError,
} from '@/domains/users/user-store';
import { useKeyboardControls } from '@/domains/gameplay/hooks/use-keyboard-controls';

import { startPuzzle, queueMove, undoMove, clearMoves } from '@/domains/puzzles/actions';
import {
  usePuzzleStore,
  selectStatus,
  selectBoard,
  selectTick,
  selectResult,
  selectSelectedTile,
} from '@/domains/puzzles/stores/puzzle-store';
import { PuzzleBoard } from '@/domains/puzzles/ui/puzzle-board';

import './best-start-play-page.css';

function BestStartPlayPage() {
  const currentUser = userStore(selectUser);
  const isLoading = userStore(selectIsLoading);
  const error = userStore(selectError);

  if (isLoading) return <div>Loading...</div>;
  if (!currentUser) {
    return <div className="text-red-500">{error?.message || 'Unexpected error'}</div>;
  }

  return <BestStartPlayPageContent />;
}

function BestStartPlayPageContent() {
  const status = usePuzzleStore(selectStatus);
  const board = usePuzzleStore(selectBoard);
  const tick = usePuzzleStore(selectTick);
  const result = usePuzzleStore(selectResult);
  const selectedTile = usePuzzleStore(selectSelectedTile);

  const isPlaying = status === 'playing';
  const isEnded = status === 'ended';
  const hasBoard = Boolean(board);

  useKeyboardControls({
    onMoveRequest: (dir: Direction) => {
      if (selectedTile) {
        queueMove(selectedTile, dir);
      }
    },
    onUndoMove: undoMove,
    onCancelMoves: clearMoves,
    disabled: !isPlaying,
  });

  // TODO: review tick-to-turn conversion logic (floor vs ceil), and move to @core
  // TODO: maxTurns should come from puzzle config, not be hardcoded
  const turn = Math.floor(tick / 2);
  const maxTurns = 25;

  // Calculate player stats (player 0 is the puzzle player)
  let landCount = 0;
  let armyCount = 0;
  if (board) {
    for (const row of board.grid) {
      for (const square of row) {
        if ('playerIndex' in square && square.playerIndex === 0) {
          landCount++;
          armyCount += square.units;
        }
      }
    }
  }
  if (isEnded && result) {
    landCount = result.landCount;
    armyCount = result.armyCount;
  }

  return (
    <div className="puzzle-page">
      <aside className="puzzle-sidebar">
        {isEnded && <div className="sidebar-section">Complete!</div>}

        {hasBoard && (
          <div className="sidebar-section">
            <div>
              Turn: {turn}/{maxTurns}
            </div>
            <div>Land: {landCount}</div>
            <div>Army: {armyCount}</div>
          </div>
        )}

        <div className="sidebar-section">
          <button className="puzzle-btn" onClick={startPuzzle}>
            {hasBoard ? 'Restart' : 'Start'}
          </button>
        </div>
      </aside>

      <main className="puzzle-main">
        {board ? (
          <PuzzleBoard boardState={board} />
        ) : (
          <div className="puzzle-empty-state">Click Start to begin</div>
        )}
      </main>
    </div>
  );
}

export { BestStartPlayPage };

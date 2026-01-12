import clsx from 'clsx';

import type { Direction } from '@core/types';

import {
  userStore,
  selectUser,
  selectIsLoading,
  selectError,
} from '@/domains/users/user-store';
import { useKeyboardControls } from '@/domains/gameplay/hooks/use-keyboard-controls';

import {
  startPuzzle,
  queueMove,
  undoMove,
  clearMoves,
} from '@/domains/puzzles/actions/puzzle-actions';
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

  return currentUser ? (
    <BestStartPlayPageContent />
  ) : isLoading ? (
    <div>Loading...</div>
  ) : (
    <div className="text-red">{error ? error.message : 'Unexpected error'}</div>
  );
}

function BestStartPlayPageContent() {
  const status = usePuzzleStore(selectStatus);

  return (
    <div className="best-start-play-page p-10">
      <h3>Best Start Puzzle</h3>
      <p className="text-gray-600 mb-4">Expand as much as possible in 25 turns!</p>

      {status === 'idle' && <IdleUI />}
      {status === 'playing' && <PlayingUI />}
      {status === 'ended' && <EndedUI />}
    </div>
  );
}

function IdleUI() {
  return (
    <div>
      <Button onClick={startPuzzle}>Start</Button>
    </div>
  );
}

function PlayingUI() {
  const board = usePuzzleStore(selectBoard);
  const tick = usePuzzleStore(selectTick);
  const selectedTile = usePuzzleStore(selectSelectedTile);

  useKeyboardControls({
    onMoveRequest: (dir: Direction) => {
      if (selectedTile) {
        queueMove(selectedTile, dir);
      }
    },
    onUndoMove: undoMove,
    onCancelMoves: clearMoves,
    disabled: false,
  });

  if (!board) return null;

  // TODO: review tick-to-turn conversion logic (floor vs ceil), and move to @core
  // TODO: maxTurns should come from puzzle config, not be hardcoded
  const turn = Math.floor(tick / 2);
  const maxTurns = 25;

  // Calculate player stats (player 0 is the puzzle player)
  let landCount = 0;
  let armyCount = 0;
  for (const row of board.grid) {
    for (const square of row) {
      if ('playerIndex' in square && square.playerIndex === 0) {
        landCount++;
        armyCount += square.units;
      }
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="mb-4 flex gap-6">
        <span>
          Turn: {turn}/{maxTurns}
        </span>
        <span>Land: {landCount}</span>
        <span>Army: {armyCount}</span>
      </div>

      <div className="flex-1 min-h-0">
        <PuzzleBoard boardState={board} />
      </div>
    </div>
  );
}

function EndedUI() {
  const board = usePuzzleStore(selectBoard);
  const result = usePuzzleStore(selectResult);

  if (!result) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="mb-4">
        <h4 className="text-lg font-semibold mb-2">Puzzle Complete!</h4>
        <div className="flex gap-6">
          <span>Final Land: {result.landCount}</span>
          <span>Final Army: {result.armyCount}</span>
        </div>
      </div>

      <div className="mb-4">
        <Button onClick={startPuzzle}>Play Again</Button>
      </div>

      {board && (
        <div className="flex-1 min-h-0">
          <PuzzleBoard boardState={board} />
        </div>
      )}
    </div>
  );
}

function Button({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx(
        'bg-transparent text-blue-700 font-semibold',
        'py-2 px-4 border border-blue-500 rounded',
        'hover:bg-blue-500 hover:text-white hover:border-transparent',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export { BestStartPlayPage };

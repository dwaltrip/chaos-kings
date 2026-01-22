import type { BoardState, Direction } from '@core/types';
import { DEFAULT_BEST_START_CONFIG } from '@core/puzzles/best-start';

import {
  userStore,
  selectUser,
  selectIsLoading,
  selectError,
  User,
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
import { TurnCounter } from '@/domains/gameplay/pages/gameplay/turn-counter';
import { ArmyInfoRow, ArmyInfoTable } from '@/domains/gameplay/pages/gameplay/army-info';

function BestStartPlayPage() {
  const currentUser = userStore(selectUser);
  const isLoading = userStore(selectIsLoading);
  const error = userStore(selectError);

  if (isLoading) return <div>Loading...</div>;
  if (!currentUser) {
    return <div className="text-red-500">{error?.message || 'Unexpected error'}</div>;
  }

  return <BestStartPlayPageContent user={currentUser} />;
}

interface PageContentPropTypes {
  user: User;
}

function BestStartPlayPageContent({ user }: PageContentPropTypes) {
  const status = usePuzzleStore(selectStatus);
  const board = usePuzzleStore(selectBoard);
  const tick = usePuzzleStore(selectTick);
  const result = usePuzzleStore(selectResult);
  const selectedTile = usePuzzleStore(selectSelectedTile);
  const timingConfig = DEFAULT_BEST_START_CONFIG.timing;

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

  let { army: armyCount, land: landCount } = board
    ? getArmyStats(board)
    : { army: 0, land: 0 };
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
            <TurnCounter tick={tick} timingConfig={timingConfig} />

            <ArmyInfoTable>
              <ArmyInfoRow
                name={user.username}
                color="lightblue"
                armyCount={armyCount}
                landCount={landCount}
              />
            </ArmyInfoTable>
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

// TODO: backend should send this up
function getArmyStats(board: BoardState): { army: number; land: number } {
  // Calculate player stats (player 0 is the puzzle player)
  let land = 0;
  let army = 0;
  if (board) {
    for (const row of board.grid) {
      for (const square of row) {
        if ('playerIndex' in square && square.playerIndex === 0) {
          land++;
          army += square.units;
        }
      }
    }
  }
  return { army, land };
}

export { BestStartPlayPage };

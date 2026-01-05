import clsx from 'clsx';
import { useEffect } from 'react';

import { makeGeneralSquare } from '@core/map/make-squares';
import { makeBlankMap } from '@core/map/make-blank-map';

import type { User } from '@/domains/users/types';
import {
  userStore,
  selectUser,
  selectIsLoading,
  selectError,
} from '@/domains/users/user-store';

import { startPlayingPuzzles } from '@/domains/puzzles/actions';

import { useGameplayStoreV2 } from '@/domains/gameplay/stores/gameplay-store-v2';
import { GameBoard } from '@/domains/gameplay/ui/game-board';

import './best-start-play-page.css';

function buildMap() {
  const grid = makeBlankMap(21, 21);
  grid[10][10] = makeGeneralSquare({ x: 10, y: 10 }, 0);
  return grid;
}

const GRID = buildMap();
const BOARD = {
  grid: GRID,
  size: {
    height: GRID.length,
    width: GRID[0].length,
  },
};

function BestStartPlayPage() {
  const currentUser = userStore(selectUser);
  const isLoading = userStore(selectIsLoading);
  const error = userStore(selectError);

  return currentUser ? (
    <BestStartPlayPageContent user={currentUser} />
  ) : // TODO: create nice abstraction for this?
  isLoading ? (
    <div>Loading...</div>
  ) : (
    <div className="text-red">{error ? error.message : 'Unexpected error'}</div>
  );
}

function BestStartPlayPageContent({ user }: { user: User }) {
  // const [map, setMap] = useState(null);
  // useEffect(() =>

  const startPuzzle = () => {
    startPlayingPuzzles(user);
  };

  useEffect(() => {
    const { updateBoard } = useGameplayStoreV2.getState().actions;
    updateBoard(BOARD);
  }, []);

  return (
    <div className="best-start-play-page p-10">
      <h3>Play Puzzle</h3>
      <br />

      <Button onClick={startPuzzle}>Start!</Button>

      <PuzzleUI />
    </div>
  );
}

function PuzzleUI() {
  return <GameBoard boardState={BOARD} disabled={false} />;
}

function Button({ children, onClick }: any) {
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

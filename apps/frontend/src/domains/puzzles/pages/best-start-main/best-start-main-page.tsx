import clsx from 'clsx';
import { useNavigate } from 'react-router';

import type { User } from '@/domains/users/types';

import {
  userStore,
  selectUser,
  // selectIsLoading,
} from '@/domains/users/user-store';
import { startPlayingPuzzles } from '@/domains/puzzles/actions';

function BestStartMainPage() {
  const currentUser = userStore(selectUser);
  // const isLoading = userStore(selectIsLoading);

  return currentUser ? (
    <BestStartMainPageContent user={currentUser} />
  ) : (
    <div>Loading...</div>
  );
}

interface PageProps {
  user: User;
}
function BestStartMainPageContent({ user }: PageProps) {
  const navigate = useNavigate();

  const startPuzzle = () => {
    // startPlayingPuzzles(user);
    navigate('/puzzles/play');
  };

  return (
    <div className="best--main-page p-10">
      <Button onClick={startPuzzle}>Start Puzzle!</Button>
    </div>
  );
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

export { BestStartMainPage };

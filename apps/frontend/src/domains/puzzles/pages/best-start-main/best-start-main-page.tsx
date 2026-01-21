import { useEffect } from 'react';
import { Link } from 'react-router';

import type { User } from '@/domains/users/types';
import {
  userStore,
  selectUser,
  selectIsLoading,
  selectError,
} from '@/domains/users/user-store';
import { loadUserStats } from '@/domains/puzzles/actions';
import { UserStats } from '@/domains/puzzles/ui/user-stats';

function BestStartMainPage() {
  const currentUser = userStore(selectUser);
  const isLoading = userStore(selectIsLoading);
  const error = userStore(selectError);

  return currentUser ? (
    <BestStartMainPageContent user={currentUser} />
  ) : // TODO: create nice abstraction for this?
  isLoading ? (
    <div>Loading...</div>
  ) : (
    <div className="text-red">{error ? error.message : 'Unexpected error'}</div>
  );
}

interface PageProps {
  user: User;
}
function BestStartMainPageContent({ user }: PageProps) {
  useEffect(() => {
    void loadUserStats();
  }, []);

  console.log('Puzzles Main Page - user:', user.username);
  return (
    <div className="best-start-main-page p-10">
      <h1 className="mb-6 text-2xl font-bold text-white">Best Start Puzzle</h1>
      <div className="mb-6">
        <UserStats />
      </div>
      <Link
        to="/puzzles/play"
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Play Puzzle
      </Link>
    </div>
  );
}

export { BestStartMainPage };

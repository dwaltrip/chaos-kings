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
  const startPuzzle = () => {
    startPlayingPuzzles(user);
  };

  return (
    <div className="best--main-page">
      <button onClick={startPuzzle}>Start Puzzle!</button>
    </div>
  );
}

export { BestStartMainPage };

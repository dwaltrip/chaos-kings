import { Link } from 'react-router';

import type { User } from '@/domains/users/types';

import {
  userStore,
  selectUser,
  selectIsLoading,
  selectError,
} from '@/domains/users/user-store';

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
  console.log('Puzzles Main Page - user:', user.username);
  return (
    <div className="best--main-page p-10">
      <Link to="/puzzles/play">Play Puzzles</Link>
    </div>
  );
}

export { BestStartMainPage };

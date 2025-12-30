import {
  selectIsLoading,
  selectUser,
  userStore,
  type User,
} from '@/domains/users/user-store';

import { UserInfo } from './user-info';
import { LobbyChat } from './lobby-chat';
import { GamesSpotlight } from './games-spotlight';
import { PlayGameControls } from './play-game-controls';

import './home-page.css';

const Loading = () => <div>Loading...</div>;
const ErrorMessage = ({ message }: { message: string }) => (
  <div className="error">{message}</div>
);

function HomePage() {
  const user = userStore(selectUser);
  const isUserLoading = userStore(selectIsLoading);
  const error = userStore((state) => state.error);

  return (
    <div className="home-page">
      {error && <ErrorMessage message={`Error loading user: ${error.message}`} />}
      {isUserLoading && <Loading />}
      {user && <HomePageContent user={user} />}
    </div>
  );
}

function HomePageContent({ user }: { user: User }) {
  return (
    <>
      <div className="col">
        <UserInfo user={user} />
      </div>

      <div className="col">
        <PlayGameControls />
        <GamesSpotlight />
      </div>

      <div className="col">
        <LobbyChat />
      </div>
    </>
  );
}

export { HomePage };

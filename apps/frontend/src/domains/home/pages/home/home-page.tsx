import {
  selectIsLoading,
  selectUser,
  userStore,
  type User,
} from '@/domains/users/user-store';
import { UserInfo } from './user-info';

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
    <div>
      <UserInfo user={user} />

      <div className="lobby-chat">- user list - message list - message input</div>

      <div className="games-spotlight">
        - featured / cool / recently played games list
      </div>

      <div className="play-game-controls">
        - game mode selection - start game button - queue status - active players per mode
        - queue settings
      </div>
    </div>
  );
}

export { HomePage };

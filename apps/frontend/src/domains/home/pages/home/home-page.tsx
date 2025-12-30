import {
  selectIsLoading,
  selectUser,
  userStore,
  type User,
} from '@/domains/users/user-store';

import { Col, ColSection } from './home-page-layout';
import { UserInfo } from './user-info';
import { LobbyChat } from './lobby-chat';
import { ServerPlayerStats } from './server-player-stats';
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
    <div className="home-page home-page-layout">
      {error && <ErrorMessage message={`Error loading user: ${error.message}`} />}
      {isUserLoading && <Loading />}
      {user && <HomePageContent user={user} />}
    </div>
  );
}

function HomePageContent({ user }: { user: User }) {
  return (
    <>
      <Col>
        <ColSection>
          <UserInfo user={user} />
        </ColSection>
      </Col>

      <Col>
        <ColSection>
          <ServerPlayerStats />
        </ColSection>

        <ColSection>
          {/* active players per mode */}
          <PlayGameControls />
        </ColSection>

        {/* <GamesSpotlight /> */}
      </Col>

      <Col>
        <ColSection>
          <LobbyChat />
        </ColSection>
      </Col>
    </>
  );
}

export { HomePage };

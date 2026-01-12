import {
  selectIsLoading,
  selectUser,
  userStore,
  type User,
} from '@/domains/users/user-store';

import { Col, ColSection } from './home-page-layout';
import { UserInfo } from './user-info';
import { ServerPlayerStats } from './server-player-stats';
import { PlayGameControls } from './play-game-controls';

import './home-page.css';
import { Link } from 'react-router';

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
      <Col className="user-col">
        <ColSection>
          <UserInfo user={user} />
        </ColSection>
      </Col>

      <Col className="main-col">
        <ColSection>
          <ServerPlayerStats />
        </ColSection>

        <ColSection>
          {/* active players per mode */}
          <PlayGameControls />
          <div>
            <Link to="/puzzles">Puzzles!</Link>
          </div>
        </ColSection>

        {/* <GamesSpotlight /> */}
      </Col>

      {/*
      <Col className="chat-col">
        <ColSection>
          <LobbyChat />
        </ColSection>
      </Col>
      */}
    </>
  );
}

export { HomePage };

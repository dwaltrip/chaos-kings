import { Routes, Route, NavLink, useLocation } from 'react-router';

import { HomePage } from '@/pages/home/home-page';
import { GameplayPage } from '@/pages/gameplay/gameplay-page';
import { GameListPage } from '@/pages/games-list/game-list-page';
import { JoinGamePage } from '@/pages/join-game/join-game-page';
import { ReplayPage } from '@/domains/replay/pages/replay-page';
import { useUserSessionAndWsInit } from '@/hooks/use-user-session-and-ws-init';

function App() {
  const { ready } = useUserSessionAndWsInit();
  const location = useLocation();

  if (!ready) {
    return <div className="p-5 text-center">Loading...</div>;
  }

  const isGamePage = location.pathname.match(/^\/games\/[^/]+$/);
  const isReplayPage = location.pathname.match(/^\/replay\/[^/]+$/);
  const hideNav = isGamePage || isReplayPage;

  return (
    <div className="app">
      {!hideNav && (
        <nav className="p-5 border-b border-gray-300 mb-5">
          <NavLink to="/" className="mr-5">
            Home
          </NavLink>
          <NavLink to="/games" className="mr-5">
            Games
          </NavLink>
          <NavLink to="/join-game" className="mr-5">
            Find Game
          </NavLink>
        </nav>
      )}

      <Routes>
        <Route index element={<HomePage />} />
        <Route path="games" element={<GameListPage />} />
        <Route path="games/:gameId" element={<GameplayPage />} />
        <Route path="join-game" element={<JoinGamePage />} />
        <Route path="replay/:gameId" element={<ReplayPage />} />
      </Routes>
    </div>
  );
}

export { App };

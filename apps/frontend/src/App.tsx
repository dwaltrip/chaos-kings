import { Routes, Route } from 'react-router';

import { HomePage } from '@/domains/home/pages/home/home-page';
import { GameplayPage } from '@/pages/gameplay/gameplay-page';
import { GameListPage } from '@/pages/games-list/game-list-page';
import { JoinGamePage } from '@/pages/join-game/join-game-page';
import { ReplayPage } from '@/domains/replay/pages/replay-page';
import { useUserSessionAndWsInit } from '@/hooks/use-user-session-and-ws-init';

function App() {
  const { ready } = useUserSessionAndWsInit();

  if (!ready) {
    return <div className="p-5 text-center">Loading...</div>;
  }
  return (
    <div className="app">
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

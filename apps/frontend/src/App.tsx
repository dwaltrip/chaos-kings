import { Routes, Route } from 'react-router';

// import { HomePage } from '@/pages/home/home-page';
import { HomePage } from '@/domains/home/pages/home/home-page';
import { ProfilePage } from '@/domains/users/pages/profile/profile-page';

import { GameplayPage } from '@/pages/gameplay/gameplay-page';
import { GameListPage } from '@/pages/games-list/game-list-page';
import { JoinGamePage } from '@/pages/join-game/join-game-page';
import { ReplayPage } from '@/domains/replay/pages/replay-page';

import { BestStartMainPage, BestStartPlayPage } from '@/domains/puzzles/pages';
import { SandboxPage } from '@/domains/sandbox/pages';
import { GameUiLabPage } from '@/domains/game-ui-lab/pages/game-ui-lab-page';

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
        <Route path="users/:userId" element={<ProfilePage />} />

        <Route path="games" element={<GameListPage />} />
        <Route path="games/:gameId" element={<GameplayPage />} />
        <Route path="join-game" element={<JoinGamePage />} />
        <Route path="replay/:gameId" element={<ReplayPage />} />

        <Route path="puzzles" element={<BestStartMainPage />} />
        <Route path="puzzles/play" element={<BestStartPlayPage />} />

        <Route path="sandbox" element={<SandboxPage />} />
        <Route path="game-ui-lab" element={<GameUiLabPage />} />
      </Routes>
    </div>
  );
}

export { App };

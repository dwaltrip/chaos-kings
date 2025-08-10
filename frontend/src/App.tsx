import { Routes, Route, NavLink, useLocation } from "react-router";
import { HomePage } from "@/pages/home/home-page";
import { GamePage } from '@/pages/game/game-page';
import { GameListPage } from '@/pages/games/game-list-page';
import { JoinGamePage } from '@/pages/join-game/join-game-page';
import { useUserWebSocketInit } from '@/hooks/use-user-websocket-init';

function App() {
  const { isReady } = useUserWebSocketInit();
  const location = useLocation();
  
  if (!isReady) {
    return <div className="p-5 text-center">Loading...</div>;
  }

  const isGamePage = location.pathname.match(/^\/games\/[^/]+$/);

  return (
    <div className="app">
      {!isGamePage && (
        <nav className="p-5 border-b border-gray-300 mb-5">
          <NavLink to="/" className="mr-5">Home</NavLink>
          <NavLink to="/games" className="mr-5">Games</NavLink>
          <NavLink to="/join-game" className="mr-5">Find Game</NavLink>
        </nav>
      )}

      <div className={isGamePage ? "" : "p-5"}>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="games" element={<GameListPage />} />
          <Route path="games/:gameId" element={<GamePage />} />
          <Route path="join-game" element={<JoinGamePage />} />
        </Routes>
      </div>
    </div>
  );
}

export { App };

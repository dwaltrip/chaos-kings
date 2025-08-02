import { useEffect } from 'react';
import { Routes, Route, NavLink } from "react-router";
import { HomePage } from "@/pages/home/home-page";
import { GamePage } from '@/pages/game/game-page';
import { GameListPage } from '@/pages/games/game-list-page';
import { userStore } from '@/stores/user-store';

function App() {
  const { isLoading, isInitialized, actions } = userStore();
  
  useEffect(() => {
    if (!isInitialized) {
      actions.initializeUser();
    }
  }, [isInitialized, actions]);
  
  if (!isInitialized || isLoading) {
    return <div className="p-5 text-center">Loading...</div>;
  }

  return (
    <div className="app">
      <nav className="p-5 border-b border-gray-300 mb-5">
        <NavLink to="/" className="mr-5">Home</NavLink>
        <NavLink to="/games" className="mr-5">Games</NavLink>
      </nav>

      <div className="p-5">
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="games" element={<GameListPage />} />
          <Route path="games/:gameId" element={<GamePage />} />
        </Routes>
      </div>
    </div>
  );
}

export { App };

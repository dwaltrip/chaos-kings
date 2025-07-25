import { Routes, Route, NavLink } from "react-router";
import { HomePage } from "@/pages/home/home-page";
import { GamePage } from '@/pages/game/game-page';

function App() {
  return (
    <div className="app">
      <nav className="p-5 border-b border-gray-300 mb-5">
        <NavLink to="/" className="mr-5">Home</NavLink>
      </nav>

      <div className="p-5">
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="games/:gameId" element={<GamePage />} />
        </Routes>
      </div>
    </div>
  );
}

export { App };

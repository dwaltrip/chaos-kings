import { NavLink, useLocation } from 'react-router';

function AppNav() {
  const location = useLocation();

  const isGamePage = location.pathname.match(/^\/games\/[^/]+$/);
  const isReplayPage = location.pathname.match(/^\/replay\/[^/]+$/);
  const hideNav = isGamePage || isReplayPage;

  return (
    !hideNav && (
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
    )
  );
}

export { AppNav };

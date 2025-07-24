import { Routes, Route, NavLink } from "react-router";
import { HomePage } from '@/pages/HomePage';
import { AboutPage } from '@/pages/AboutPage';

function App() {
  return (
    <div className="app">
      <nav style={{ padding: '20px', borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
        <NavLink to="/" style={{ marginRight: '20px' }}>Home</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
      
      <div style={{ padding: '20px' }}>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
        </Routes>
      </div>
    </div>
  );
}

export { App };

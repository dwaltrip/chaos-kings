import { Routes, Route, NavLink } from "react-router";
import { HomePage } from "@/pages/home/home-page";
import { AboutPage } from '@/pages/about/about-page';

function App() {
  return (
    <div className="app">
      <nav className="p-5 border-b border-gray-300 mb-5">
        <NavLink to="/" className="mr-5">Home</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>

      <div className="p-5">
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
        </Routes>
      </div>
    </div>
  );
}

export { App };

import React, { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import Roadmap from './pages/Roadmap';

// PUBLIC_INTERFACE
export default function App() {
  /** App root shell providing routes and top navigation. */
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <div className="App">
      <header className="topbar" role="banner" aria-label="Application header">
        <nav className="navbar" aria-label="Primary">
          <Link to="/" className="brand" aria-label="Career Navigator Home">
            Career Navigator
          </Link>
          <div className="nav-actions">
            <Link to="/" className="nav-link">
              Dashboard
            </Link>
          </div>
        </nav>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title="Toggle color theme"
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </header>
      <main className="main-container" role="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/roadmap" element={<Roadmap />} />
        </Routes>
      </main>
      <footer className="footer" role="contentinfo">
        <small>© {new Date().getFullYear()} Career Navigator MVP</small>
      </footer>
    </div>
  );
}

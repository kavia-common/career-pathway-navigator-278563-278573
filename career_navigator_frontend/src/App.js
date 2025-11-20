import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import Roadmap from './pages/Roadmap';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';

// Small internal component for nav actions to access auth hooks
function NavActions() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onLogout = () => {
    logout();
    // Redirect to login and preserve where user was
    navigate('/login', { replace: true, state: { from: location } });
  };
  return (
    <div className="nav-actions">
      <Link to="/" className="nav-link">
        Dashboard
      </Link>
      {isAuthenticated ? (
        <button className="btn ghost" onClick={onLogout} aria-label="Sign out">
          Sign out
        </button>
      ) : (
        <Link to="/login" className="nav-link">
          Sign in
        </Link>
      )}
    </div>
  );
}

// PUBLIC_INTERFACE
export default function App() {
  /** App root shell providing routes and top navigation. */
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <AuthProvider>
      <div className="App">
        <header className="topbar" role="banner" aria-label="Application header">
          <nav className="navbar" aria-label="Primary">
            <Link to="/" className="brand" aria-label="Career Navigator Home">
              Career Navigator
            </Link>
            <NavActions />
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
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/roadmap"
              element={
                <ProtectedRoute>
                  <Roadmap />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        <footer className="footer" role="contentinfo">
          <small>© {new Date().getFullYear()} Career Navigator MVP</small>
        </footer>
      </div>
    </AuthProvider>
  );
}

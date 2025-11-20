import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
// PUBLIC_INTERFACE
 */
export const AuthContext = createContext({
  isAuthenticated: false,
  login: async (_u, _p) => false,
  logout: () => {},
});

/**
 * Time-safe-ish string equality by comparing all chars and length in one pass.
 * Note: Client-side timing resistance is best-effort only.
 */
function safeEquals(a = '', b = '') {
  const aStr = String(a);
  const bStr = String(b);
  const len = Math.max(aStr.length, bStr.length);
  let diff = aStr.length ^ bStr.length;
  for (let i = 0; i < len; i++) {
    const ac = aStr.charCodeAt(i) || 0;
    const bc = bStr.charCodeAt(i) || 0;
    diff |= ac ^ bc;
  }
  return diff === 0;
}

/**
 * Resolve public env variables from window.__ENV__ first, then process.env (CRA-inline at build), then defaults.
 * Defaults are safe for local development and NOT secrets.
 */
function resolveExpectedCreds() {
  const w = typeof window !== 'undefined' ? window : {};
  const env = (w && w.__ENV__) || {};
  const user =
    (typeof env.REACT_APP_AUTH_USER === 'string' && env.REACT_APP_AUTH_USER) ||
    (typeof process !== 'undefined' &&
      process &&
      process.env &&
      typeof process.env.REACT_APP_AUTH_USER === 'string' &&
      process.env.REACT_APP_AUTH_USER) ||
    'demo';
  const pass =
    (typeof env.REACT_APP_AUTH_PASS === 'string' && env.REACT_APP_AUTH_PASS) ||
    (typeof process !== 'undefined' &&
      process &&
      process.env &&
      typeof process.env.REACT_APP_AUTH_PASS === 'string' &&
      process.env.REACT_APP_AUTH_PASS) ||
    'demo123';
  return { user, pass };
}

/**
// PUBLIC_INTERFACE
 */
export function AuthProvider({ children }) {
  /** Provide auth state and actions across the app. Persists to localStorage. */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const expectedRef = useRef(resolveExpectedCreds());

  // load persisted auth flag at mount
  useEffect(() => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token === 'true') setIsAuthenticated(true);
    } catch {
      // ignore storage errors
    }
  }, []);

  const login = useCallback(async (username, password) => {
    // Basic input validation
    const u = String(username || '').trim();
    const p = String(password || '');
    if (!u || !p) return false;

    // Avoid logging credentials; compare with constant-time-like function
    const { user: expectedUser, pass: expectedPass } = expectedRef.current;
    const ok = safeEquals(u, expectedUser) && safeEquals(p, expectedPass);
    if (ok) {
      try {
        // Use a simple flag token; no real JWT in this stub
        localStorage.setItem('auth_token', 'true');
      } catch {
        // ignore storage errors but still allow in-memory auth
      }
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('auth_token');
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      login,
      logout,
    }),
    [isAuthenticated, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
// PUBLIC_INTERFACE
 */
export function useAuth() {
  /** Hook to access authentication context. */
  return useContext(AuthContext);
}

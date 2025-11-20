import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
// PUBLIC_INTERFACE
 */
export default function ProtectedRoute({ children }) {
  /**
   * If not authenticated, redirect to /login and preserve the intended path in state.
   */
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
// PUBLIC_INTERFACE
 */
export default function Login() {
  /** Minimal login form that validates against env-provided fixed credentials. */
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = useMemo(() => location.state?.from?.pathname || '/', [location.state]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setNote('');
    if (!username.trim() || !password) {
      setNote('Please enter username and password.');
      return;
    }
    setSubmitting(true);
    const ok = await login(username, password);
    setSubmitting(false);
    if (!ok) {
      setNote('Invalid credentials.');
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="panel" style={{ maxWidth: 420, margin: '40px auto' }} aria-labelledby="login-title">
      <h2 id="login-title">Sign in</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        This is a frontend-only authentication stub for demo purposes.
      </p>
      <form onSubmit={onSubmit} autoComplete="off" aria-describedby="login-help">
        <div id="login-help" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
          Enter your credentials to continue.
        </div>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-required="true"
            aria-invalid={!!note && !username.trim()}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            inputMode="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-required="true"
            aria-invalid={!!note && !password}
          />
        </div>
        <button className="btn" type="submit" disabled={submitting} aria-label="Sign in">
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
        {note && (
          <div role="alert" style={{ color: '#f43f5e', marginTop: 8 }}>
            {note}
          </div>
        )}
      </form>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        Security note: do not reuse real passwords. This stub validates against environment-provided demo values on the client only.
      </div>
    </div>
  );
}

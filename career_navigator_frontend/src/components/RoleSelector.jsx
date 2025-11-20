import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api/client';
import { sanitizeLabel } from '../utils/sanitize';

/**
// PUBLIC_INTERFACE
 */
export default function RoleSelector() {
  /** Fetch roles and allow selection of current and target roles, navigating to roadmap */
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Load roles once on mount; internal state updates are handled explicitly
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      const res = await apiGet('/roles');
      if (!active) return;
      if (res.ok && Array.isArray(res.data)) {
        const next = res.data.map((r) => ({ id: String(r.id), name: sanitizeLabel(r.name || r.id) }));
        setRoles(next);
        // preselect common seeded roles if present
        const ca = next.find((x) => x.name === 'Chief Architect');
        const cto = next.find((x) => x.name === 'CTO');
        // Update defaults without relying on effect deps
        if (ca) setCurrentRole((prev) => prev || ca.id);
        if (cto) setTargetRole((prev) => prev || cto.id);
        if (next.length === 0) {
          setError('No roles available. Verify backend is running and database seeded.');
        }
      } else {
        setRoles([]);
        setError(res.error || 'Failed to load roles. Check REACT_APP_API_BASE and CORS.');
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!currentRole || !targetRole) {
      setError('Please select both current and target roles.');
      return;
    }
    if (currentRole === targetRole) {
      setError('Current and target roles should be different.');
      return;
    }
    navigate(`/roadmap?fromRole=${encodeURIComponent(currentRole)}&toRole=${encodeURIComponent(targetRole)}`);
  };

  return (
    <div className="panel" aria-labelledby="role-selector-title">
      <h2 id="role-selector-title">Select Roles</h2>
      <form onSubmit={onSubmit} aria-describedby="role-selector-help">
        <div id="role-selector-help" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
          Choose your current and target roles to generate the roadmap.
        </div>
        <div className="form-group">
          <label htmlFor="currentRole">Current Role</label>
          <select
            id="currentRole"
            className="select"
            aria-label="Select current role"
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value)}
          >
            <option value="">-- Select --</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="targetRole">Target Role</label>
          <select
            id="targetRole"
            className="select"
            aria-label="Select target role"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          >
            <option value="">-- Select --</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <div role="status" aria-live="polite">
            Loading roles...
          </div>
        ) : (
          <button type="submit" className="btn" aria-label="Generate roadmap">
            Generate Roadmap
          </button>
        )}
        {error && (
          <div role="alert" style={{ color: '#f43f5e', marginTop: 8 }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
}

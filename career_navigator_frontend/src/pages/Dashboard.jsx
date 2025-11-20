import React from 'react';
import RoleSelector from '../components/RoleSelector';

/**
// PUBLIC_INTERFACE
 */
export default function Dashboard() {
  /** Landing page with role selector and summary placeholders */
  return (
    <div className="dashboard">
      <section className="panel" aria-labelledby="welcome-title">
        <h2 id="welcome-title">Welcome</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Choose your current and target roles to generate a visual career roadmap and track your progress.
        </p>
      </section>

      <RoleSelector />

      <section className="panel" aria-labelledby="summary-title">
        <h3 id="summary-title">Summary</h3>
        <ul className="list">
          <li>Role-based assessment results will appear here.</li>
          <li>Highlights of strengths and gaps will be summarized.</li>
        </ul>
      </section>
    </div>
  );
}

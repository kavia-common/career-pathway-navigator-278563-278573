import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Graph from '../components/Graph';
import ProgressPanel from '../components/ProgressPanel';
import Recommendations from '../components/Recommendations';

/**
// PUBLIC_INTERFACE
 */
export default function Roadmap() {
  /** Roadmap view showing graph, progress, and recommendations */
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const fromRole = params.get('fromRole') || '';
  const toRole = params.get('toRole') || '';

  return (
    <div className="roadmap-layout" aria-label="Roadmap">
      <section className="panel" aria-labelledby="graph-title">
        <h2 id="graph-title">Career Roadmap</h2>
        <Graph fromRole={fromRole} toRole={toRole} />
      </section>
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ProgressPanel />
        <Recommendations roleId={toRole} />
      </aside>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import { sanitizeLabel } from '../utils/sanitize';

/**
// PUBLIC_INTERFACE
 */
export default function Recommendations({ roleId, skillId }) {
  /** Fetch basic recommendations and show list */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await apiGet('/recommendations', { roleId, skillId });
      if (!active) return;
      if (res.ok && Array.isArray(res.data)) {
        setItems(
          res.data.map((r, idx) => ({
            id: String(r.id ?? idx),
            title: sanitizeLabel(r.title || r.name || `Recommendation ${idx + 1}`),
            summary: sanitizeLabel(r.summary || r.description || ''),
          })),
        );
      } else {
        setItems([]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [roleId, skillId]);

  return (
    <div className="panel" aria-labelledby="reco-title">
      <h3 id="reco-title">Recommendations</h3>
      {loading ? (
        <div role="status">Loading recommendations...</div>
      ) : items.length === 0 ? (
        <div role="note">No recommendations yet.</div>
      ) : (
        <ul className="list" aria-label="Recommendations list">
          {items.map((it) => (
            <li key={it.id}>
              <div style={{ fontWeight: 600 }}>{it.title}</div>
              {it.summary && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{it.summary}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

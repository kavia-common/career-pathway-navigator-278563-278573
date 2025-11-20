import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api/client';
import { sanitizeLabel } from '../utils/sanitize';
import { useLocation } from 'react-router-dom';

/**
// PUBLIC_INTERFACE
 */
export default function Recommendations({ roleId, skillId }) {
  /** Fetch basic recommendations for the selected target role and a selected/default skill */
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const toRole = roleId || params.get('toRole') || '';

  const [effectiveSkillId, setEffectiveSkillId] = useState(skillId || '');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // If no skillId passed, pick first skill from role detail
  useEffect(() => {
    let active = true;
    (async () => {
      if (skillId || !toRole) {
        setEffectiveSkillId(skillId || '');
        return;
      }
      // resolve role name from id
      const roles = await apiGet('/roles');
      if (!roles.ok || !Array.isArray(roles.data)) return;
      const match = roles.data.find((r) => String(r.id) === String(toRole));
      if (!match) return;
      const roleDetail = await apiGet(`/roles/${encodeURIComponent(match.name)}`);
      if (!active) return;
      if (roleDetail.ok && roleDetail.data && Array.isArray(roleDetail.data.skills) && roleDetail.data.skills.length) {
        setEffectiveSkillId(String(roleDetail.data.skills[0].skill.id));
      }
    })();
    return () => {
      active = false;
    };
  }, [toRole, skillId]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!toRole || !effectiveSkillId) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await apiGet('/recommendations', { roleId: toRole, skillId: effectiveSkillId });
      if (!active) return;
      if (res.ok && Array.isArray(res.data)) {
        setItems(
          res.data.map((r, idx) => ({
            id: String(r.id ?? idx),
            title: sanitizeLabel(r.title || r.name || `Recommendation ${idx + 1}`),
            summary: sanitizeLabel(r.details || r.summary || r.description || ''),
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
  }, [toRole, effectiveSkillId]);

  return (
    <div className="panel" aria-labelledby="reco-title">
      <h3 id="reco-title">Recommendations</h3>
      {loading ? (
        <div role="status">Loading recommendations...</div>
      ) : items.length === 0 ? (
        <div role="note">No recommendations yet or failed to load.</div>
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

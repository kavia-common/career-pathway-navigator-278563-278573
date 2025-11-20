import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../api/client';
import { sanitizeLabel } from '../utils/sanitize';
import { useLocation } from 'react-router-dom';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'working_on', label: 'Working On' },
  { value: 'complete', label: 'Complete' },
];

/**
// PUBLIC_INTERFACE
 */
export default function ProgressPanel() {
  /** Show progress list and allow updating statuses securely for the selected current role */
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const fromRole = params.get('fromRole') || '';
  const [roleName, setRoleName] = useState('');
  const [skills, setSkills] = useState([]); // [{id, name}]
  const [items, setItems] = useState([]); // [{skillId, name, status, current_level}]
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  // Resolve roleName from role ID by listing roles and matching
  const resolveRoleName = async (roleId) => {
    const res = await apiGet('/roles');
    if (res.ok && Array.isArray(res.data)) {
      const found = res.data.find((r) => String(r.id) === String(roleId));
      return found ? found.name : '';
    }
    return '';
  };

  const load = async () => {
    setLoading(true);
    setNote('');
    try {
      if (!fromRole) {
        setItems([]);
        setNote('No role selected.');
        setLoading(false);
        return;
      }
      const name = await resolveRoleName(fromRole);
      setRoleName(name);
      // Fetch role details to list required skills
      const roleDetail = name ? await apiGet(`/roles/${encodeURIComponent(name)}`) : { ok: false };
      if (!roleDetail.ok) {
        setNote('Failed to load role details. Verify API base and role name.');
      }
      const reqSkills =
        roleDetail.ok && roleDetail.data && Array.isArray(roleDetail.data.skills)
          ? roleDetail.data.skills.map((rs) => ({
              id: String(rs.skill.id),
              name: sanitizeLabel(rs.skill.name),
            }))
          : [];
      setSkills(reqSkills);

      // Load progress for this role
      const prog = name ? await apiGet(`/roles/${encodeURIComponent(name)}/progress`) : { ok: false };
      const progressBySkillId =
        prog.ok && Array.isArray(prog.data)
          ? new Map(prog.data.map((p) => [String(p.skill_id), { status: p.status, current_level: p.current_level }]))
          : new Map();

      const merged = reqSkills.map((s) => {
        const p = progressBySkillId.get(String(s.id));
        return {
          skillId: String(s.id),
          name: s.name,
          status: p?.status || 'not_started',
          current_level: typeof p?.current_level === 'number' ? p.current_level : 0,
        };
      });

      setItems(merged);
    } catch (e) {
      setItems([]);
      setNote('Failed to load progress.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromRole]);

  const updateStatus = async (skillId, status) => {
    // optimistic update
    setItems((prev) => prev.map((it) => (it.skillId === skillId ? { ...it, status } : it)));
    if (!roleName) return;
    // Resolve skill name from the validated required skills list
    const skillMeta = skills.find((s) => String(s.id) === String(skillId));
    const skillName = sanitizeLabel(skillMeta?.name || '');
    // Guard: do not call backend for invalid/placeholder names
    if (!skillName || skillName === 'NA') {
      setNote('Cannot update progress for an invalid skill. Please select a valid role-required skill.');
      // revert optimistic update
      setItems((prev) => prev.map((it) => (it.skillId === skillId ? { ...it, status: 'not_started' } : it)));
      return;
    }
    // POST /roles/{role_name}/progress?skill_name=&status=&current_level=
    const currentLevel =
      items.find((it) => String(it.skillId) === String(skillId))?.current_level ?? 0;
    const res = await apiPost(
      `/roles/${encodeURIComponent(roleName)}/progress`,
      {}, // body not required by backend
      { skill_name: skillName, status, current_level: currentLevel },
    );
    if (!res.ok) {
      const errDetail =
        typeof res.data?.detail === 'object'
          ? res.data.detail.message || 'Validation error'
          : res.error || 'Request failed';
      setNote(`Failed to update progress: ${errDetail}`);
      // revert if needed
      setItems((prev) => prev.map((it) => (it.skillId === skillId ? { ...it, status: 'not_started' } : it)));
    } else {
      // Broadcast normalized status so the Graph can adjust colors/gaps immediately
      const normalizedStatus =
        status === 'complete' ? 'completed' : status === 'working_on' ? 'in_progress' : 'not_started';
      try {
        window.dispatchEvent(
          new CustomEvent('progress:update', {
            detail: { skillId: String(skillId), status, normalizedStatus },
          }),
        );
      } catch {
        // ignore event failures
      }
    }
  };

  return (
    <div className="panel" aria-labelledby="progress-title">
      <h3 id="progress-title">Progress</h3>
      {loading ? (
        <div role="status" aria-live="polite">
          Loading progress...
        </div>
      ) : items.length === 0 ? (
        <div role="note">{note || 'No items to display.'}</div>
      ) : (
        <ul className="list" aria-label="Progress items">
          {items.map((it) => (
            <li key={it.skillId}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <span>{it.name}</span>
                <select
                  aria-label={`Update status for ${it.name}`}
                  value={it.status}
                  onChange={(e) => updateStatus(it.skillId, e.target.value)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
      {note ? <div role="status" style={{ marginTop: 8, color: 'var(--text-muted)' }}>{note}</div> : null}
    </div>
  );
}

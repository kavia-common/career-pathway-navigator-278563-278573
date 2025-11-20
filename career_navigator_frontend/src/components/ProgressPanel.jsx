import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';
import { sanitizeLabel } from '../utils/sanitize';

const STATUS_OPTIONS = [
  { value: 'none', label: 'Not Started' },
  { value: 'working_on', label: 'Working On' },
  { value: 'complete', label: 'Complete' },
];

/**
// PUBLIC_INTERFACE
 */
export default function ProgressPanel() {
  /** Show progress list and allow updating statuses securely */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await apiGet('/progress');
    if (res.ok && Array.isArray(res.data)) {
      setItems(
        res.data.map((i) => ({
          skillId: String(i.skillId ?? i.id ?? ''),
          name: sanitizeLabel(i.name || i.skill || i.id),
          status: ['none', 'working_on', 'complete'].includes(i.status) ? i.status : 'none',
        })),
      );
    } else {
      // Graceful empty state
      setItems([]);
      setNote('No progress data yet.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (skillId, status) => {
    // optimistic update
    setItems((prev) => prev.map((it) => (it.skillId === skillId ? { ...it, status } : it)));
    const res = await apiPost('/progress', { skillId, status });
    if (!res.ok) {
      setNote('Failed to update progress. Please try again.');
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
    </div>
  );
}

import React from 'react';

// PUBLIC_INTERFACE
export default function DetailPanel({ open, onClose, loading, error, detail }) {
  /**
   * Accessible side panel/modal that renders details for roles or skills.
   * Props:
   * - open: boolean to show/hide
   * - onClose: function to close the panel
   * - loading: boolean loading state
   * - error: string error message
   * - detail: object with shape:
   *    { type: 'role'|'skill', id, name, description?, category?, skills?, roles? }
   */
  if (!open) return null;

  const title =
    detail?.type === 'role'
      ? `Role: ${detail?.name || ''}`
      : detail?.type === 'skill'
      ? `Skill: ${detail?.name || ''}`
      : 'Details';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-title"
      className="detail-panel"
    >
      <div className="header">
        <h3 id="detail-title">
          {title}
        </h3>
        <button className="btn ghost" aria-label="Close details" onClick={onClose}>
          ✕
        </button>
      </div>

      {loading ? (
        <div role="status" aria-live="polite">
          Loading details...
        </div>
      ) : error ? (
        <div role="alert" style={{ color: '#fca5a5' }}>
          {error}
        </div>
      ) : !detail ? (
        <div role="note">No details to display.</div>
      ) : (
        <div>
          {detail.description ? (
            <p style={{ marginTop: 4, marginBottom: 12, lineHeight: 1.5 }}>{detail.description}</p>
          ) : null}

          {detail.type === 'role' && Array.isArray(detail.skills) && detail.skills.length > 0 ? (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Required skills</div>
              <ul className="list">
                {detail.skills.map((rs) => (
                  <li key={rs.skill.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{rs.skill.name}</span>
                    <span title="Required level" className="muted" data-muted="true">
                      L{rs.required_level}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.type === 'skill' ? (
            <>
              {detail.category ? (
                <div style={{ marginBottom: 8 }}>
                  <span className="muted" data-muted="true">Category:</span> {detail.category}
                </div>
              ) : null}
              {Array.isArray(detail.roles) && detail.roles.length > 0 ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Required by roles</div>
                  <ul className="list">
                    {detail.roles.map((rr) => (
                      <li key={rr.role.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span>{rr.role.name}</span>
                        <span title="Required level" className="muted" data-muted="true">
                          L{rr.required_level}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

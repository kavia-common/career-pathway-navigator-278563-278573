/**
 * Legend for graph progress states with accessible labels and dynamic counts.
 */
import React from "react";

// PUBLIC_INTERFACE
export default function Legend({ counts }) {
  /**
   * PUBLIC: Render legend with live counts by state.
   * counts?: { not_started?: number, in_progress?: number, completed?: number, gaps?: number }
   */
  const c = counts || {};
  const items = [
    { color: "#9CA3AF", label: "Not Started", count: c.not_started || 0 },
    { color: "#F59E0B", label: "In Progress", count: c.in_progress || 0 },
    { color: "#3B82F6", label: "Completed", count: c.completed || 0 },
    { color: "#EF4444", label: "Gap Highlight", count: c.gaps || 0 },
  ];
  return (
    <div
      aria-label="Progress legend"
      role="region"
      className="legend"
      style={{
        background: "var(--overlay-bg)",
        border: "1px solid var(--border-color)",
        borderRadius: 8,
        padding: 12,
        color: "var(--overlay-fg)",
        maxWidth: 280,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Legend</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((it) => (
          <li key={it.label} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <span
              aria-hidden="true"
              style={{
                width: 14,
                height: 14,
                background: it.color,
                borderRadius: 3,
                display: "inline-block",
                marginRight: 8,
                border: "1px solid #374151",
              }}
            />
            <span style={{ fontSize: 14 }}>
              {it.label} ({it.count})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Legend for graph progress states with accessible labels.
 */
import React from "react";

export default function Legend() {
  const items = [
    { color: "#9CA3AF", label: "Not Started" },
    { color: "#F59E0B", label: "In Progress" },
    { color: "#10B981", label: "Completed" },
    { color: "#EF4444", label: "Gap Highlight" },
  ];
  return (
    <div
      aria-label="Progress legend"
      role="region"
      className="legend"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 12,
        color: "#111827",
        maxWidth: 260,
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
            <span style={{ fontSize: 14 }}>{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Roadmap Library page: list saved roadmaps and allow loading one.
 */
import React, { useEffect, useState } from "react";
import { listRoadmaps, getRoadmap } from "../api/client";

export default function RoadmapLibrary({ userId = "demo-user", onLoadRoadmap }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await listRoadmaps(userId);
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr("Failed to load roadmaps");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const load = async (id) => {
    try {
      const rm = await getRoadmap(id, userId);
      onLoadRoadmap?.(rm);
    } catch {
      setErr("Failed to fetch roadmap");
    }
  };

  if (loading) return <div>Loading roadmaps...</div>;
  if (err) return <div role="alert" style={{ color: "#b91c1c" }}>{err}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Saved Roadmaps</h2>
      {items.length === 0 ? (
        <p>No saved roadmaps yet.</p>
      ) : (
        <ul style={{ padding: 0, listStyle: "none" }}>
          {items.map((it) => (
            <li
              key={it.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 600 }}>{it.name}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                From #{it.from_role_id} → #{it.to_role_id}
              </div>
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => load(it.id)}
                  aria-label={`Load roadmap ${it.name}`}
                  style={{
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 12px",
                    cursor: "pointer",
                  }}
                >
                  Load
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

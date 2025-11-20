import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listRoadmaps, getRoadmap } from "../api/client";
import Graph from "../components/Graph";

/**
// PUBLIC_INTERFACE
 */
export default function RoadmapLibrary({ userId = "demo-user", onLoadRoadmap }) {
  /**
   * Saved Roadmaps Library
   * - Lists roadmaps for user
   * - Preview: renders saved graph inline without overwriting the current session
   * - Open: navigates to the main Roadmap view with saved graph loaded
   */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [previewId, setPreviewId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await listRoadmaps(userId);
        setItems(Array.isArray(data) ? data : []);
      } catch (_e) {
        setErr("Failed to load roadmaps");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const handlePreview = async (id) => {
    if (previewId === id) {
      // Toggle off
      setPreviewId(null);
      setPreviewData(null);
      return;
    }
    try {
      setPreviewLoading(true);
      setErr("");
      const rm = await getRoadmap(id, userId);
      setPreviewId(id);
      setPreviewData(rm?.graph_payload || null);
    } catch (_e) {
      setErr("Failed to preview roadmap");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpen = async (id) => {
    try {
      setErr("");
      const rm = await getRoadmap(id, userId);
      const fromId = rm?.from_role_id || 0;
      const toId = rm?.to_role_id || 0;
      const initialGraph = rm?.graph_payload || null;

      if (typeof onLoadRoadmap === "function") {
        onLoadRoadmap(rm);
      } else {
        // Navigate to main Roadmap view with initialGraph in navigation state
        const params = new URLSearchParams({
          fromRole: String(fromId || ""),
          toRole: String(toId || ""),
        });
        navigate(`/roadmap?${params.toString()}`, {
          replace: false,
          state: { initialGraph },
        });
      }
    } catch (_e) {
      setErr("Failed to open roadmap");
    }
  };

  if (loading) return <div>Loading roadmaps...</div>;
  if (err) return <div role="alert" style={{ color: "#b91c1c" }}>{err}</div>;

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2>Saved Roadmaps</h2>
      {items.length === 0 ? (
        <p>No saved roadmaps yet.</p>
      ) : (
        <ul style={{ padding: 0, listStyle: "none" }} aria-label="Saved roadmap list">
          {items.map((it) => (
            <li
              key={it.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                background: "var(--panel-bg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{it.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    From #{it.from_role_id} → #{it.to_role_id}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handlePreview(it.id)}
                    aria-label={`Preview roadmap ${it.name}`}
                    className="btn ghost"
                  >
                    {previewId === it.id ? "Hide Preview" : "Preview"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpen(it.id)}
                    aria-label={`Open roadmap ${it.name}`}
                    className="btn"
                  >
                    Open
                  </button>
                </div>
              </div>

              {previewId === it.id && (
                <div style={{ marginTop: 12 }}>
                  {previewLoading ? (
                    <div role="status" aria-live="polite">Loading preview…</div>
                  ) : previewData ? (
                    <div className="panel" style={{ padding: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Preview</div>
                      <Graph
                        userId={userId}
                        initialGraph={previewData}
                        fromRoleId={it.from_role_id}
                        toRoleId={it.to_role_id}
                        previewMode
                        containerHeight={320}
                      />
                    </div>
                  ) : (
                    <div role="note">No preview data.</div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

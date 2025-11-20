/**
 * Graph visualization component with progress editing and Save Roadmap button.
 * This is a lightweight placeholder integrating API helpers and Legend.
 */
import React, { useEffect, useMemo, useState } from "react";
import { getGraph, createRoadmap } from "../api/client";
import Legend from "./Legend";

// Simple node renderer as list for MVP; assumes upstream D3 renderer can be integrated.
export default function Graph({
  fromRoleId,
  toRoleId,
  userId = "demo-user",
  initialGraph, // optional: when loading a saved roadmap
}) {
  const [graph, setGraph] = useState(initialGraph || null);
  const [progressByNode, setProgressByNode] = useState({});
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const progressOptions = [
    { value: "not_started", label: "Not Started", color: "#9CA3AF" },
    { value: "in_progress", label: "In Progress", color: "#F59E0B" },
    { value: "completed", label: "Completed", color: "#10B981" },
  ];

  const progressMapForRequest = useMemo(() => {
    const map = {};
    Object.entries(progressByNode).forEach(([id, v]) => {
      map[id] = { progress: v.progress, percent: v.percent ?? undefined };
    });
    return map;
  }, [progressByNode]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!fromRoleId || !toRoleId || initialGraph) return;
      try {
        const g = await getGraph(fromRoleId, toRoleId, progressMapForRequest);
        if (mounted) setGraph(g);
      } catch {
        setErr("Failed to load graph");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [fromRoleId, toRoleId, progressMapForRequest, initialGraph]);

  useEffect(() => {
    // If initialGraph provided by loader, seed local progress state
    if (initialGraph && initialGraph.nodes) {
      const seed = {};
      initialGraph.nodes.forEach((n) => {
        if (n.type === "skill") {
          const id = n.id;
          const pr = n.progress || null;
          const pct = Number.isInteger(n.percent_complete) ? n.percent_complete : undefined;
          if (pr) seed[id] = { progress: pr, percent: pct };
        }
      });
      setProgressByNode(seed);
      setGraph(initialGraph);
    }
  }, [initialGraph]);

  const updateProgress = (nodeId, progressValue) => {
    setProgressByNode((prev) => ({
      ...prev,
      [nodeId]: { ...(prev[nodeId] || {}), progress: progressValue },
    }));
  };

  const updatePercent = (nodeId, percent) => {
    const val = Math.max(0, Math.min(100, parseInt(percent || "0", 10) || 0));
    setProgressByNode((prev) => ({
      ...prev,
      [nodeId]: { ...(prev[nodeId] || {}), percent: val },
    }));
  };

  const saveRoadmap = async () => {
    if (!graph) return;
    try {
      setSaving(true);
      setErr("");
      const payload = {
        name: name?.trim() || `Roadmap ${fromRoleId}→${toRoleId}`,
        user_identifier: userId,
        from_role_id: Number(fromRoleId),
        to_role_id: Number(toRoleId),
        // include progress back into nodes
        graph_payload: {
          ...graph,
          nodes: (graph.nodes || []).map((n) => {
            if (n.type !== "skill") return n;
            const meta = progressByNode[n.id];
            if (!meta) return n;
            return {
              ...n,
              progress: meta.progress,
              percent_complete: Number.isInteger(meta.percent) ? meta.percent : undefined,
            };
          }),
        },
        notes: null,
      };
      const res = await createRoadmap(payload);
      // update local graph with any normalized payload
      setGraph(res.graph_payload);
    } catch (e) {
      setErr("Failed to save roadmap");
    } finally {
      setSaving(false);
    }
  };

  const skillNodes = (graph?.nodes || []).filter((n) => n.type === "skill");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            aria-label="Roadmap name"
            placeholder="Roadmap name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: "8px 10px",
              flex: 1,
            }}
          />
          <button
            type="button"
            onClick={saveRoadmap}
            disabled={saving || !graph}
            style={{
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 12px",
              cursor: "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Roadmap"}
          </button>
        </div>
        {err && (
          <div role="alert" style={{ color: "#b91c1c", marginBottom: 8 }}>
            {err}
          </div>
        )}
        <div>
          <h3>Skills</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 120px", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Skill</div>
            <div style={{ fontWeight: 600 }}>Progress</div>
            <div style={{ fontWeight: 600 }}>% Complete</div>
            {skillNodes.map((n) => {
              const meta = progressByNode[n.id] || {};
              return (
                <React.Fragment key={n.id}>
                  <div>{n.label}</div>
                  <div>
                    <select
                      aria-label={`Progress for ${n.label}`}
                      value={meta.progress || ""}
                      onChange={(e) => updateProgress(n.id, e.target.value)}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        padding: "6px 8px",
                        width: "100%",
                      }}
                    >
                      <option value="">—</option>
                      {progressOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      aria-label={`Percent complete for ${n.label}`}
                      value={meta.percent ?? ""}
                      placeholder="0-100"
                      min={0}
                      max={100}
                      onChange={(e) => updatePercent(n.id, e.target.value)}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        padding: "6px 8px",
                        width: "100%",
                      }}
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <Legend />
      </div>
    </div>
  );
}

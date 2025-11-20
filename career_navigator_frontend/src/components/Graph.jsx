import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { getGraph, createRoadmap, apiGet } from "../api/client";
import { mapGraphPayload, getMockGraph } from "../utils/graphMapper";
import Legend from "./Legend";
import DetailPanel from "./DetailPanel";

/**
 * Helpers to determine gap styling.
 */
function isGapNode(n) {
  return !!(n?.is_gap || n?.color === "#ef4444" || (typeof n?.gap === "number" && n.gap > 0));
}
function isGapLink(l) {
  return !!(l?.is_gap || l?.color === "#ef4444");
}

// PUBLIC_INTERFACE
export default function Graph({
  /** 
   * Interactive D3 force-directed graph for roadmap visualization.
   * Props:
   * - fromRole, toRole: string/number IDs from router (preferred)
   * - fromRoleId, toRoleId: optional legacy numeric IDs for compatibility
   * - userId: identifier to scope saved roadmaps (demo only)
   * - initialGraph: optional preloaded graph (e.g., from saved roadmap)
   */
  fromRole,
  toRole,
  fromRoleId,
  toRoleId,
  userId = "demo-user",
  initialGraph,
}) {
  // Internal state for graph data and UX
  const [graph, setGraph] = useState(null); // mapped graph { nodes, links }
  const [lastGoodGraph, setLastGoodGraph] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Optional progress state mapping nodeId -> { progress, percent }, seeded from initial graph if present.
  const [progressByNode, setProgressByNode] = useState({});

  // Detail panel state for node info
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState(null);

  // Derive effective role IDs regardless of prop naming (router uses fromRole/toRole)
  const effectiveFromRoleId = useMemo(() => {
    const v = fromRoleId ?? fromRole;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [fromRole, fromRoleId]);

  const effectiveToRoleId = useMemo(() => {
    const v = toRoleId ?? toRole;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [toRole, toRoleId]);

  // Map progress to request echo format
  const progressMapForRequest = useMemo(() => {
    const map = {};
    Object.entries(progressByNode).forEach(([id, v]) => {
      map[id] = { progress: v.progress, percent: v.percent ?? undefined };
    });
    return map;
  }, [progressByNode]);

  // Seed from initialGraph if provided (e.g., loaded roadmap)
  useEffect(() => {
    if (initialGraph && typeof initialGraph === "object") {
      try {
        const mapped = mapGraphPayload(initialGraph);
        setGraph(mapped);
        setLastGoodGraph(mapped);
        // seed progress state
        const seed = {};
        (Array.isArray(initialGraph.nodes) ? initialGraph.nodes : []).forEach((n) => {
          if (n.type === "skill") {
            const id = String(n.id);
            const pr = n.progress || null;
            const pct = Number.isInteger(n.percent_complete) ? n.percent_complete : undefined;
            if (pr) seed[id] = { progress: pr, percent: pct };
          }
        });
        if (Object.keys(seed).length) {
          setProgressByNode(seed);
        }
      } catch {
        // fall back to mock if mapping fails, but don't crash
        const mock = getMockGraph();
        setGraph(mock);
        setLastGoodGraph(mock);
      }
    }
  }, [initialGraph]);

  // Fetch graph from backend when ids change and no initialGraph is provided
  useEffect(() => {
    let active = true;
    (async () => {
      if (!effectiveFromRoleId || !effectiveToRoleId || initialGraph) return;
      setLoading(true);
      setErr("");
      try {
        const payload = await getGraph(effectiveFromRoleId, effectiveToRoleId, progressMapForRequest);
        if (!active) return;
        const mapped = mapGraphPayload(payload);
        setGraph(mapped);
        setLastGoodGraph(mapped);
      } catch (_e) {
        // Keep last good graph if available; otherwise fallback to mock
        if (!active) return;
        setErr("Failed to load graph. Check API base or CORS; showing last known graph if available.");
        if (!lastGoodGraph) {
          const mock = getMockGraph();
          setGraph(mock);
          setLastGoodGraph(mock);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [effectiveFromRoleId, effectiveToRoleId, progressMapForRequest, initialGraph, lastGoodGraph]);

  // D3 rendering
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const simulationRef = useRef(null);

  // Track dimensions for the force layout
  const [dims, setDims] = useState({ width: 800, height: 500 });
  useEffect(() => {
    function measure() {
      try {
        const el = wrapperRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const width = Math.max(300, rect.width || 800);
        const height = Math.max(300, rect.height || 500);
        setDims({ width, height });
      } catch {
        // noop
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Draw/Update the graph whenever data or dimensions change
  useEffect(() => {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.links)) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;

    // Cleanup any existing simulation
    if (simulationRef.current) {
      try {
        simulationRef.current.stop();
      } catch {
        // ignore
      }
      simulationRef.current = null;
    }

    // Clear the SVG and set up basics
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${dims.width} ${dims.height}`).attr("width", "100%").attr("height", "100%");

    // Define arrow marker to match CSS marker-end url(#arrow)
    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 10)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "currentColor");

    // Root group to zoom/pan
    const gRoot = svg.append("g").attr("class", "graph-content");

    // Zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 3])
      .on("zoom", (event) => {
        gRoot.attr("transform", event.transform);
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    // Draw links
    const link = gRoot
      .append("g")
      .attr("stroke-linecap", "round")
      .selectAll("line")
      .data(graph.links)
      .join("line")
      .attr("class", (d) => `link arrow${isGapLink(d) ? " gap" : ""}`)
      .attr("stroke", (d) => (isGapLink(d) ? "#ef4444" : null))
      .attr("stroke-width", 1.5);

    // Draw nodes
    const node = gRoot
      .append("g")
      .selectAll("circle")
      .data(graph.nodes)
      .join("circle")
      .attr("class", (d) => `node ${d.type}${isGapNode(d) ? " gap" : ""}`)
      .attr("r", (d) => (d.type === "role" ? 10 : 7))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("tabIndex", 0)
      .on("click", (_event, d) => onNodeClick(d))
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulationRef.current.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulationRef.current.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Labels
    const label = gRoot
      .append("g")
      .selectAll("text")
      .data(graph.nodes)
      .join("text")
      .attr("font-size", 12)
      .attr("class", "graph-label")
      .text((d) => d.label)
      .attr("pointer-events", "none");

    // Force simulation
    const simulation = d3
      .forceSimulation(graph.nodes)
      .force(
        "link",
        d3
          .forceLink(graph.links)
          .id((d) => d.id)
          .distance((l) => {
            const t = l.type || l.kind;
            if (t === "requires" || t === "needs") return 70;
            return 50;
          })
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(dims.width / 2, dims.height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d) => (d.type === "role" ? 26 : 18)).strength(0.7)
      )
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source?.x ?? 0))
          .attr("y1", (d) => (d.source?.y ?? 0))
          .attr("x2", (d) => (d.target?.x ?? 0))
          .attr("y2", (d) => (d.target?.y ?? 0));

        node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);

        label
          .attr("x", (d) => (d.x ?? 0) + 12)
          .attr("y", (d) => (d.y ?? 0) + 4);
      });

    simulationRef.current = simulation;

    // Cleanup on change/unmount
    return () => {
      try {
        simulation.stop();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, dims.width, dims.height]);

  const onResetZoom = () => {
    const svg = d3.select(svgRef.current);
    if (zoomRef.current) {
      svg.transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  // Load detail for clicked node and show panel
  async function onNodeClick(node) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    try {
      if (node.type === "role") {
        // Prefer numeric id endpoint
        let res = null;
        const rid = Number(node.entity_id);
        if (Number.isFinite(rid) && rid > 0) {
          res = await apiGet(`/roles/by-id/${encodeURIComponent(rid)}`);
        }
        if (!res || !res.ok) {
          // Fallback by name/label
          res = await apiGet(`/roles/${encodeURIComponent(node.label)}`);
        }
        if (res.ok) {
          setDetail({
            type: "role",
            id: res.data?.id ?? node.entity_id ?? node.id,
            name: res.data?.name ?? node.label,
            description: res.data?.description ?? "",
            skills: Array.isArray(res.data?.skills) ? res.data.skills : [],
          });
        } else {
          setDetailError("Failed to load role details.");
        }
      } else {
        // skill
        let res = null;
        const sid = Number(node.entity_id);
        if (Number.isFinite(sid) && sid > 0) {
          res = await apiGet(`/skills/${encodeURIComponent(sid)}`);
        }
        if (!res || !res.ok) {
          res = await apiGet(`/skills/by-name/${encodeURIComponent(node.label)}`);
        }
        if (res.ok) {
          setDetail({
            type: "skill",
            id: res.data?.id ?? node.entity_id ?? node.id,
            name: res.data?.name ?? node.label,
            description: res.data?.description ?? "",
            category: res.data?.category ?? "",
            roles: Array.isArray(res.data?.roles) ? res.data.roles : [],
          });
        } else {
          setDetailError("Failed to load skill details.");
        }
      }
    } catch {
      setDetailError("Network error while loading details.");
    } finally {
      setDetailLoading(false);
    }
  }

  const saveRoadmap = async () => {
    if (!graph) return;
    try {
      setSaving(true);
      setErr("");
      // sanitize nodes/links so we don't send D3 simulation internals
      const cleanNodes = (graph.nodes || []).map((n) => {
        const meta = progressByNode[String(n.id)] || {};
        return {
          id: String(n.id),
          type: n.type,
          label: n.label,
          entity_id: typeof n.entity_id === "number" ? n.entity_id : undefined,
          color: typeof n.color === "string" ? n.color : undefined,
          is_gap: typeof n.is_gap === "boolean" ? n.is_gap : undefined,
          gap: typeof n.gap === "number" ? n.gap : undefined,
          progress: meta.progress || n.progress || undefined,
          percent_complete:
            Number.isInteger(meta.percent) ? meta.percent : n.percent_complete || undefined,
        };
      });
      const cleanLinks = (graph.links || []).map((l) => ({
        source: String(typeof l.source === "object" ? l.source.id : l.source),
        target: String(typeof l.target === "object" ? l.target.id : l.target),
        type: l.type || l.kind || "rel",
        level: typeof l.level === "number" ? l.level : undefined,
        from: l.from || undefined,
        color: typeof l.color === "string" ? l.color : undefined,
        is_gap: typeof l.is_gap === "boolean" ? l.is_gap : undefined,
      }));
      const payload = {
        name: name?.trim() || `Roadmap ${effectiveFromRoleId ?? "?"}→${effectiveToRoleId ?? "?"}`,
        user_identifier: userId,
        from_role_id: Number(effectiveFromRoleId || 0),
        to_role_id: Number(effectiveToRoleId || 0),
        graph_payload: {
          nodes: cleanNodes,
          links: cleanLinks,
          meta: {
            fromRole: { id: effectiveFromRoleId },
            toRole: { id: effectiveToRoleId },
            stats: { nodes: cleanNodes.length, links: cleanLinks.length },
          },
        },
        notes: null,
      };
      const res = await createRoadmap(payload);
      // refresh local graph with any normalized payload
      try {
        const mapped = mapGraphPayload(res.graph_payload || payload.graph_payload);
        setGraph(mapped);
        setLastGoodGraph(mapped);
      } catch {
        // ignore mapping failures; keep existing
      }
    } catch {
      setErr("Failed to save roadmap");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Actions row */}
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
          className="btn"
          style={{
            background: "var(--button-bg)",
            color: "var(--button-text)",
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

      <div className="graph-wrapper" ref={wrapperRef} aria-label="Roadmap graph">
        {/* Toolbar */}
        <div className="graph-toolbar" aria-label="Graph controls">
          <button className="btn ghost" type="button" onClick={onResetZoom}>
            Reset Zoom
          </button>
        </div>

        {/* SVG Graph */}
        <svg ref={svgRef} className="graph" role="img" aria-label="Interactive node graph" />

        {/* Loading overlay */}
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "var(--overlay-bg)",
              color: "var(--overlay-fg)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              padding: "6px 8px",
              zIndex: 20,
            }}
          >
            Loading graph...
          </div>
        ) : null}

        {/* Legend overlay */}
        <div className="graph-legend">
          <Legend />
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        error={detailError}
        detail={detail}
      />
    </div>
  );
}

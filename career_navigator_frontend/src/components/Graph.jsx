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
  const lastGoodRef = useRef(null);
  useEffect(() => {
    lastGoodRef.current = lastGoodGraph;
  }, [lastGoodGraph]);

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
      } catch (e) {
        try {
          // eslint-disable-next-line no-console
          console.warn("[Graph] Failed to map initialGraph; using mock.", e?.message || e);
        } catch {}
        const mock = getMockGraph();
        setGraph(mock);
        setLastGoodGraph(mock);
      }
    }
  }, [initialGraph]);

  // Fetch graph from backend when ids change and no initialGraph is provided
  const abortRef = useRef(null);
  const reqIdRef = useRef(0);
  useEffect(() => {
    if (!effectiveFromRoleId || !effectiveToRoleId || initialGraph) return;

    // Cancel any in-flight request
    try {
      abortRef.current?.abort();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    const myId = (reqIdRef.current += 1);
    setLoading(true);
    setErr("");
    try {
      // eslint-disable-next-line no-console
      console.debug("[Graph] fetch start", {
        id: myId,
        from: effectiveFromRoleId,
        to: effectiveToRoleId,
      });
    } catch {}

    (async () => {
      try {
        const payload = await getGraph(
          effectiveFromRoleId,
          effectiveToRoleId,
          progressMapForRequest,
          { signal: controller.signal }
        );
        if (myId !== reqIdRef.current) return; // stale result
        const mapped = mapGraphPayload(payload);
        setGraph(mapped);
        setLastGoodGraph(mapped);
        try {
          // eslint-disable-next-line no-console
          console.debug("[Graph] fetch success", {
            id: myId,
            nodes: mapped?.nodes?.length || 0,
            links: mapped?.links?.length || 0,
          });
        } catch {}
      } catch (e) {
        if (myId !== reqIdRef.current) return; // stale/aborted sequence
        if (e?.name === "AbortError") {
          // Silent on abort
          try {
            // eslint-disable-next-line no-console
            console.debug("[Graph] request aborted", { id: myId });
          } catch {}
          return;
        }
        setErr("Failed to load graph. Check API base or CORS; showing last known graph if available.");
        if (!lastGoodRef.current) {
          const mock = getMockGraph();
          setGraph(mock);
          setLastGoodGraph(mock);
        }
        try {
          // eslint-disable-next-line no-console
          console.warn("[Graph] fetch failed", { id: myId, error: e?.message || String(e) });
        } catch {}
      } finally {
        if (myId === reqIdRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
    // Intentionally NOT depending on lastGoodGraph to avoid re-fetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFromRoleId, effectiveToRoleId, progressMapForRequest, initialGraph]);

  // D3 rendering
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const simulationRef = useRef(null);
  const initializedRef = useRef(false);
  const gRootRef = useRef(null);
  const linkGroupRef = useRef(null);
  const nodeGroupRef = useRef(null);
  const labelGroupRef = useRef(null);

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

  // Initialize SVG scaffolding only once
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || initializedRef.current) return;

    const svg = d3.select(svgEl);
    svg.attr("width", "100%").attr("height", "100%").attr("viewBox", `0 0 ${dims.width} ${dims.height}`);

    // Ensure arrow marker exists
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

    // Root and sub-groups
    const gRoot = svg.append("g").attr("class", "graph-content");
    gRootRef.current = gRoot;
    linkGroupRef.current = gRoot.append("g").attr("class", "links").node();
    nodeGroupRef.current = gRoot.append("g").attr("class", "nodes").node();
    labelGroupRef.current = gRoot.append("g").attr("class", "labels").node();

    // Zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 3])
      .on("zoom", (event) => {
        gRoot.attr("transform", event.transform);
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    initializedRef.current = true;
  }, [dims.width, dims.height]);

  // Draw/Update the graph whenever data or dimensions change
  useEffect(() => {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.links)) return;
    const svgEl = svgRef.current;
    if (!svgEl || !initializedRef.current) return;

    const svg = d3.select(svgEl);
    svg.attr("viewBox", `0 0 ${dims.width} ${dims.height}`);

    const linkKey = (d) => {
      const s = typeof d.source === "object" ? d.source?.id : d.source;
      const t = typeof d.target === "object" ? d.target?.id : d.target;
      return `${s}→${t}`;
    };

    // Links join
    const link = d3
      .select(linkGroupRef.current)
      .selectAll("line")
      .data(graph.links, linkKey)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("stroke-linecap", "round")
            .attr("class", (d) => `link arrow${isGapLink(d) ? " gap" : ""}`)
            .attr("stroke", (d) => (isGapLink(d) ? "#ef4444" : null))
            .attr("stroke-width", 1.5),
        (update) =>
          update
            .attr("class", (d) => `link arrow${isGapLink(d) ? " gap" : ""}`)
            .attr("stroke", (d) => (isGapLink(d) ? "#ef4444" : null)),
        (exit) => exit.remove()
      );

    // Nodes join
    const nodeSel = d3
      .select(nodeGroupRef.current)
      .selectAll("circle")
      .data(graph.nodes, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", (d) => `node ${d.type}${isGapNode(d) ? " gap" : ""}`)
            .attr("r", (d) => (d.type === "role" ? 10 : 7))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .attr("tabIndex", 0)
            .on("click", (_event, d) => onNodeClick(d)),
        (update) =>
          update
            .attr("class", (d) => `node ${d.type}${isGapNode(d) ? " gap" : ""}`)
            .attr("r", (d) => (d.type === "role" ? 10 : 7)),
        (exit) => exit.remove()
      );

    // Labels join
    const label = d3
      .select(labelGroupRef.current)
      .selectAll("text")
      .data(graph.nodes, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("text")
            .attr("font-size", 12)
            .attr("class", "graph-label")
            .text((d) => d.label)
            .attr("pointer-events", "none"),
        (update) => update.text((d) => d.label),
        (exit) => exit.remove()
      );

    // Simulation setup or update
    let sim = simulationRef.current;
    if (!sim) {
      sim = d3.forceSimulation([]);
      simulationRef.current = sim;
    }

    sim
      .force(
        "link",
        (sim.force("link") ||
          d3.forceLink().id((d) => d.id)).distance((l) => {
          const t = l.type || l.kind;
          if (t === "requires" || t === "needs") return 70;
          return 50;
        })
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(dims.width / 2, dims.height / 2))
      .force("collision", d3.forceCollide().radius((d) => (d.type === "role" ? 26 : 18)).strength(0.7));

    // Apply data to simulation
    const linkForce = sim.force("link");
    if (linkForce) {
      linkForce.links(graph.links);
    }
    sim.nodes(graph.nodes);

    // Tick updates
    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source?.x ?? 0))
        .attr("y1", (d) => (d.source?.y ?? 0))
        .attr("x2", (d) => (d.target?.x ?? 0))
        .attr("y2", (d) => (d.target?.y ?? 0));

      nodeSel.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);

      label.attr("x", (d) => (d.x ?? 0) + 12).attr("y", (d) => (d.y ?? 0) + 4);
    });

    // Reheat simulation for new data
    sim.alpha(0.9).restart();

    // Enable dragging with stable simulation reference
    const drag = d3
      .drag()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeSel.call(drag);

    try {
      // eslint-disable-next-line no-console
      console.debug("[Graph] render draw", {
        nodes: graph.nodes.length,
        links: graph.links.length,
        dims,
      });
    } catch {}
  }, [graph, dims.width, dims.height]);

  // Stop simulation on unmount
  useEffect(() => {
    return () => {
      try {
        simulationRef.current?.stop();
      } catch {}
    };
  }, []);

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

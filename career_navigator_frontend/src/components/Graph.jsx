import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { getGraph, createRoadmap, apiGet } from "../api/client";
import { mapGraphPayload, getMockGraph } from "../utils/graphMapper";
import Legend from "./Legend";
import DetailPanel from "./DetailPanel";

const COLORS = {
  blue: "#3B82F6",
  amber: "#F59E0B",
  gray: "#9CA3AF",
  red: "#ef4444",
  role: "#3B82F6",
  skill: "#06B6D4",
};

function normalizeProgress(status) {
  if (!status) return null;
  const s = String(status).toLowerCase();
  if (s === "complete" || s === "completed") return "completed";
  if (s === "working_on" || s === "in_progress") return "in_progress";
  if (s === "not_started") return "not_started";
  return null;
}

function nodeProgress(n, progressByNode) {
  const meta = progressByNode[String(n?.id)];
  const raw = meta?.progress || n?.progress || null;
  return normalizeProgress(raw);
}

function isSkill(n) {
  return (n?.type || "").toLowerCase() === "skill";
}

function effectiveNodeIsGap(n, progressByNode) {
  const p = nodeProgress(n, progressByNode);
  if (p === "completed") return false;
  return !!(n?.is_gap || n?.color === COLORS.red || (typeof n?.gap === "number" && n.gap > 0));
}

function nodeFillColor(n, progressByNode) {
  if ((n?.type || "").toLowerCase() === "role") return COLORS.role;
  const p = nodeProgress(n, progressByNode);
  if (p === "completed") return COLORS.blue;
  if (p === "in_progress") return COLORS.amber;
  if (p === "not_started") return COLORS.gray;
  if (effectiveNodeIsGap(n, progressByNode)) return COLORS.red;
  return COLORS.skill;
}

function effectiveLinkIsGap(l, progressByNode) {
  const gapFlag = !!(l?.is_gap || l?.color === COLORS.red);
  if (!gapFlag) return false;
  const sNode = typeof l.source === "object" ? l.source : null;
  const tNode = typeof l.target === "object" ? l.target : null;
  const endpoints = [sNode, tNode].filter(Boolean);
  for (const n of endpoints) {
    if (isSkill(n)) {
      const p = nodeProgress(n, progressByNode);
      if (p === "completed") return false;
    }
  }
  return true;
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
   * - previewMode: optional boolean to hide save actions (used for in-place previews)
   * - containerHeight: optional number (px) to override default height
   */
  fromRole,
  toRole,
  fromRoleId,
  toRoleId,
  userId = "demo-user",
  initialGraph,
  previewMode = false,
  containerHeight,
}) {
  // Internal state for graph data and UX
  const [graph, setGraph] = useState(null); // normalized graph { nodes, links(sourceId/targetId), meta? }
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
            if (pr) seed[id] = { progress: normalizeProgress(pr), percent: pct };
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

  // React to global progress updates so graph colors/legend change live
  useEffect(() => {
    function onProgressUpdate(e) {
      try {
        const detail = (e && e.detail) || {};
        const skillId = detail?.skillId != null ? String(detail.skillId) : null;
        const normalized = detail?.normalizedStatus || normalizeProgress(detail?.status);
        if (!skillId || !normalized) return;
        if (!graph || !Array.isArray(graph.nodes)) return;

        const updates = {};
        for (const n of graph.nodes) {
          const idStr = String(n.id);
          const eid =
            typeof n.entity_id === "number"
              ? String(n.entity_id)
              : n.entity_id != null
              ? String(n.entity_id)
              : null;
          if ((eid && eid === skillId) || idStr === skillId || idStr === `skill:${skillId}`) {
            updates[idStr] = { progress: normalized };
          }
        }
        if (Object.keys(updates).length) {
          setProgressByNode((prev) => ({ ...prev, ...updates }));
        }
      } catch {
        // ignore
      }
    }
    window.addEventListener("progress:update", onProgressUpdate);
    return () => window.removeEventListener("progress:update", onProgressUpdate);
  }, [graph]);

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
        const payload = await getGraph(effectiveFromRoleId, effectiveToRoleId, progressMapForRequest, {
          signal: controller.signal,
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFromRoleId, effectiveToRoleId, progressMapForRequest, initialGraph]);

  // D3 scaffolding
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

  // Prepare nodes and links for D3: ensure role nodes exist, map links to node objects, and validate.
  const preparedData = useMemo(() => {
    if (!graph || !Array.isArray(graph.nodes)) return { nodes: [], simLinks: [], meta: {} };

    let nodes = [...graph.nodes];
    const meta = (graph && graph.meta) || {};

    // Ensure role nodes exist for endpoints like "role:1" and "role:2"
    const ensureRoleNode = (roleId, label) => {
      if (!roleId || !Number.isFinite(Number(roleId))) return;
      const id = `role:${Number(roleId)}`;
      if (!nodes.some((n) => String(n.id) === id)) {
        nodes.push({
          id,
          type: "role",
          label: label || `Role ${roleId}`,
          entity_id: Number(roleId),
        });
      }
    };

    // Synthesize role nodes from meta if missing; fallback to props if meta absent
    if (meta?.fromRole?.id) ensureRoleNode(meta.fromRole.id, meta.fromRole.name || null);
    else if (effectiveFromRoleId) ensureRoleNode(effectiveFromRoleId, null);

    if (meta?.toRole?.id) ensureRoleNode(meta.toRole.id, meta.toRole.name || null);
    else if (effectiveToRoleId) ensureRoleNode(effectiveToRoleId, null);

    // Build id -> node map
    const nodeById = new Map(nodes.map((n) => [String(n.id), n]));

    // Map normalized links to simulation links with concrete node objects
    const rawLinks = Array.isArray(graph.links) ? graph.links : [];
    const simLinks = [];
    for (const l of rawLinks) {
      // Backward compatibility for any old shapes
      let s = l?.sourceId ?? (typeof l?.source === "object" ? l?.source?.id : l?.source);
      let t = l?.targetId ?? (typeof l?.target === "object" ? l?.target?.id : l?.target);
      if (s == null || t == null) {
        try {
          // eslint-disable-next-line no-console
          console.warn("[Graph] skipping link with missing endpoints", l);
        } catch {}
        continue;
      }
      const sid = String(s);
      const tid = String(t);
      const sNode = nodeById.get(sid);
      const tNode = nodeById.get(tid);
      if (!sNode || !tNode) {
        try {
          // eslint-disable-next-line no-console
          console.warn("[Graph] invalid link - node not found", { sourceId: sid, targetId: tid });
        } catch {}
        continue;
      }
      simLinks.push({ ...l, source: sNode, target: tNode });
    }

    return { nodes, simLinks, meta };
  }, [graph, effectiveFromRoleId, effectiveToRoleId]);

  // Compute legend counts live
  const legendCounts = useMemo(() => {
    const nodes = preparedData.nodes || [];
    const links = preparedData.simLinks || [];
    let not_started = 0;
    let in_progress = 0;
    let completed = 0;
    let gapNodes = 0;
    let gapLinks = 0;
    for (const n of nodes) {
      if (isSkill(n)) {
        const p = nodeProgress(n, progressByNode);
        if (p === "not_started") not_started += 1;
        else if (p === "in_progress") in_progress += 1;
        else if (p === "completed") completed += 1;
      }
      if (effectiveNodeIsGap(n, progressByNode)) gapNodes += 1;
    }
    for (const l of links) {
      if (effectiveLinkIsGap(l, progressByNode)) gapLinks += 1;
    }
    return { not_started, in_progress, completed, gaps: gapNodes + gapLinks };
  }, [preparedData, progressByNode]);

  // Draw/Update the graph whenever prepared data, dimensions, or progress changes
  useEffect(() => {
    const { nodes, simLinks } = preparedData;
    if (!nodes || !simLinks) return;
    if (!Array.isArray(nodes) || !Array.isArray(simLinks)) return;
    if (!nodes.length) return;

    const svgEl = svgRef.current;
    if (!svgEl || !initializedRef.current) return;

    const svg = d3.select(svgEl);
    svg.attr("viewBox", `0 0 ${dims.width} ${dims.height}`);

    const linkKey = (d) => {
      const s = typeof d.source === "object" ? d.source?.id : d.sourceId || d.source;
      const t = typeof d.target === "object" ? d.target?.id : d.targetId || d.target;
      return `${s}→${t}`;
    };

    // Links join (use prepared simulation links)
    const link = d3
      .select(linkGroupRef.current)
      .selectAll("line")
      .data(simLinks, linkKey)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("stroke-linecap", "round")
            .attr("class", (d) => `link arrow${effectiveLinkIsGap(d, progressByNode) ? " gap" : ""}`)
            .attr("stroke", (d) => (effectiveLinkIsGap(d, progressByNode) ? COLORS.red : null))
            .attr("stroke-width", 1.5),
        (update) =>
          update
            .attr("class", (d) => `link arrow${effectiveLinkIsGap(d, progressByNode) ? " gap" : ""}`)
            .attr("stroke", (d) => (effectiveLinkIsGap(d, progressByNode) ? COLORS.red : null)),
        (exit) => exit.remove()
      );

    // Nodes join
    const nodeSel = d3
      .select(nodeGroupRef.current)
      .selectAll("circle")
      .data(nodes, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", (d) => `node ${d.type}${effectiveNodeIsGap(d, progressByNode) ? " gap" : ""}`)
            .attr("r", (d) => (d.type === "role" ? 10 : 7))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .attr("tabIndex", 0)
            .attr("fill", (d) => nodeFillColor(d, progressByNode))
            .on("click", (_event, d) => onNodeClick(d)),
        (update) =>
          update
            .attr("class", (d) => `node ${d.type}${effectiveNodeIsGap(d, progressByNode) ? " gap" : ""}`)
            .attr("r", (d) => (d.type === "role" ? 10 : 7))
            .attr("fill", (d) => nodeFillColor(d, progressByNode)),
        (exit) => exit.remove()
      );

    // Labels join
    const label = d3
      .select(labelGroupRef.current)
      .selectAll("text")
      .data(nodes, (d) => d.id)
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

    // Stop any previous simulation before creating a new one for this data update
    try {
      simulationRef.current?.stop();
    } catch {}

    // Create a new simulation for this dataset
    const sim = d3.forceSimulation(nodes);
    simulationRef.current = sim;

    sim
      .force(
        "link",
        d3
          .forceLink(simLinks)
          .id((d) => d.id)
          .distance((l) => {
            const t = l.type || l.kind;
            if (t === "requires" || t === "needs") return 70;
            return 50;
          })
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(dims.width / 2, dims.height / 2))
      .force("collision", d3.forceCollide().radius((d) => (d.type === "role" ? 26 : 18)).strength(0.7));

    // Tick updates
    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source?.x ?? 0)
        .attr("y1", (d) => d.source?.y ?? 0)
        .attr("x2", (d) => d.target?.x ?? 0)
        .attr("y2", (d) => d.target?.y ?? 0);

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
        nodes: nodes.length,
        links: simLinks.length,
        dims,
      });
    } catch {}

    // Cleanup: stop simulation for this render when dependencies change
    return () => {
      try {
        sim.stop();
      } catch {}
    };
  }, [preparedData, dims.width, dims.height, progressByNode]);

  // Stop simulation on unmount as a safeguard
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
      // Persist using backend-expected shape: source/target as string ids
      const cleanLinks = (graph.links || []).map((l) => {
        const src = l.sourceId ?? (typeof l.source === "object" ? l.source.id : l.source);
        const tgt = l.targetId ?? (typeof l.target === "object" ? l.target.id : l.target);
        return {
          source: String(src),
          target: String(tgt),
          type: l.type || l.kind || "rel",
          level: typeof l.level === "number" ? l.level : undefined,
          from: l.from || undefined,
          color: typeof l.color === "string" ? l.color : undefined,
          is_gap: typeof l.is_gap === "boolean" ? l.is_gap : undefined,
        };
      });
      const payload = {
        name: name?.trim() || `Roadmap ${effectiveFromRoleId ?? "?"}→${effectiveToRoleId ?? "?"}`,
        user_identifier: userId,
        from_role_id: Number(effectiveFromRoleId || 0),
        to_role_id: Number(effectiveToRoleId || 0),
        graph_payload: {
          nodes: cleanNodes,
          links: cleanLinks,
          meta: {
            ...(graph.meta || {}),
            fromRole: { id: effectiveFromRoleId, ...(graph.meta?.fromRole || {}) },
            toRole: { id: effectiveToRoleId, ...(graph.meta?.toRole || {}) },
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
      {!previewMode && (
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
      )}

      {err && (
        <div role="alert" style={{ color: "#b91c1c", marginBottom: 8 }}>
          {err}
        </div>
      )}

      <div
        className="graph-wrapper"
        ref={wrapperRef}
        aria-label="Roadmap graph"
        style={containerHeight ? { height: containerHeight } : undefined}
      >
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
          <Legend counts={legendCounts} />
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

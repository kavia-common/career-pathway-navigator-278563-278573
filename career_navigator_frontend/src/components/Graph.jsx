import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { apiGet, fetchRoleById, fetchRoleByName, fetchSkillById, fetchSkillByName } from '../api/client';
import { mapGraphPayload, getMockGraph } from '../utils/graphMapper';
import DetailPanel from './DetailPanel';

/**
// PUBLIC_INTERFACE
 */
export default function Graph({ fromRole, toRole, provideData }) {
  /**
   * Render force-directed graph using React-managed SVG elements.
   * Uses d3-force for layout and d3-zoom bound to inner <g>.
   */
  const [data, setData] = useState({ nodes: [], links: [], counts: { nodes: 0, links: 0 } });
  const [error, setError] = useState('');
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);
  const simRef = useRef(null);

  // Details state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState(null);

  const fetchData = async () => {
    setError('');
    if (provideData && provideData.nodes) {
      setData(mapGraphPayload(provideData));
      return;
    }
    const res = await apiGet('/graph', { fromRole: String(fromRole || ''), toRole: String(toRole || '') });
    if (res.ok && res.data) {
      const mapped = mapGraphPayload(res.data);
      try {
        // eslint-disable-next-line no-console
        console.debug('[Graph] /graph meta', res.data.meta || {});
        // eslint-disable-next-line no-console
        console.debug('[Graph] counts', mapped.counts);
      } catch (_) {}
      if (mapped.counts.nodes === 0) {
        // fall back to mock for empty
        setData(getMockGraph());
      } else {
        setData(mapped);
      }
    } else {
      // fallback to mock when API not available
      setData(getMockGraph());
      if (res.error) setError('Using mock data. Backend not reachable. Check REACT_APP_API_BASE and CORS.');
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromRole, toRole]);

  const colorForNode = (n) => {
    // Return inline style object with fill color if provided, else use classes
    if (n.color) return { style: { fill: n.color } };
    if (n.is_gap) return { style: { fill: '#ef4444' } };
    // fallback by type to CSS classes
    if (n.type === 'role') return { className: 'node role' };
    return { className: 'node skill' };
  };

  // Initialize zoom behavior
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    const zoomBehavior = d3.zoom().scaleExtent([0.25, 4]).on('zoom', (event) => {
      // Only mutate transform on <g> in zoom handler to keep React in control elsewhere
      g.attr('transform', event.transform);
    });
    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;
    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  const resetZoom = () => {
    const svg = d3.select(svgRef.current);
    if (zoomRef.current) {
      svg.transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  // Setup and run force simulation when data changes
  useEffect(() => {
    if (!data.nodes.length) return;

    const nodes = data.nodes.map((d) => ({ ...d }));
    const links = data.links.map((l) => ({ ...l }));

    const sim = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance((l) => (l.kind === 'needs' ? 120 : 80))
          .strength(0.2),
      )
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(0, 0))
      .force('collide', d3.forceCollide().radius(() => 32).strength(0.7))
      .alphaDecay(0.05);

    simRef.current = { sim, nodes, links };

    const ticked = () => {
      // Force tick updates - we store positions on state via refs; React reads via useMemo below
      setPositions({
        nodes: nodes.map((n) => ({ id: n.id, x: n.x || 0, y: n.y || 0 })),
        links: links.map((l) => ({
          source: typeof l.source === 'object' ? l.source.id : l.source,
          target: typeof l.target === 'object' ? l.target.id : l.target,
        })),
      });
    };

    sim.on('tick', ticked);

    return () => {
      sim.stop();
      sim.on('tick', null);
    };
  }, [data]);

  const [positions, setPositions] = useState({ nodes: [], links: [] });

  const nodePos = useMemo(() => {
    const map = new Map();
    for (const n of positions.nodes) map.set(n.id, n);
    return map;
  }, [positions.nodes]);

  const linkLines = useMemo(() => {
    return data.links.map((l, idx) => {
      const s = nodePos.get(typeof l.source === 'object' ? l.source.id : l.source);
      const t = nodePos.get(typeof l.target === 'object' ? l.target.id : l.target);
      return {
        key: `${typeof l.source === 'object' ? l.source.id : l.source}-${typeof l.target === 'object' ? l.target.id : l.target}-${idx}`,
        x1: s ? s.x : 0,
        y1: s ? s.y : 0,
        x2: t ? t.x : 0,
        y2: t ? t.y : 0,
        kind: l.kind || 'rel',
        color: l.color || (l.is_gap ? '#ef4444' : undefined),
        is_gap: l.is_gap === true,
      };
    });
  }, [data.links, nodePos]);

  const nodesWithPos = useMemo(() => {
    return data.nodes.map((n) => {
      const p = nodePos.get(n.id) || { x: 0, y: 0 };
      return { ...n, ...p };
    });
  }, [data.nodes, nodePos]);

  // Handle node click -> fetch detail
  const handleNodeClick = async (n) => {
    try {
      setDetailError('');
      setDetailOpen(true);
      setDetailLoading(true);
      setDetail(null);

      if (n.type === 'role') {
        const roleId =
          typeof n.entity_id === 'number'
            ? n.entity_id
            : String(n.id || '').startsWith('role:')
            ? Number(String(n.id).split(':').slice(-1)[0])
            : undefined;
        let res = roleId ? await fetchRoleById(roleId) : await fetchRoleByName(String(n.label || '').trim());
        if (!res.ok) {
          // try alternative method if available
          if (roleId) {
            res = await fetchRoleByName(String(n.label || '').trim());
          } else if (String(n.id || '').startsWith('role:')) {
            const altId = Number(String(n.id).split(':').slice(-1)[0]);
            if (altId) res = await fetchRoleById(altId);
          }
        }
        if (res.ok && res.data) {
          setDetail({ type: 'role', id: res.data.id, name: res.data.name, description: res.data.description, skills: res.data.skills || [] });
        } else {
          setDetailError(res.error || 'Failed to fetch role details');
        }
      } else if (n.type === 'skill') {
        const skillId = typeof n.entity_id === 'number' ? n.entity_id : undefined;
        let res = skillId ? await fetchSkillById(skillId) : await fetchSkillByName(String(n.label || '').trim());
        if (!res.ok && !skillId && String(n.id || '').startsWith('skill:')) {
          const name = String(n.id).split(':').slice(1).join(':'); // preserve names with colons
          res = await fetchSkillByName(name);
        }
        if (res.ok && res.data) {
          setDetail({
            type: 'skill',
            id: res.data.id,
            name: res.data.name,
            description: res.data.description,
            category: res.data.category,
            roles: res.data.roles || [],
          });
        } else {
          setDetailError(res.error || 'Failed to fetch skill details');
        }
      } else {
        setDetailError('Unsupported node type');
      }
    } catch (e) {
      setDetailError('Unexpected error while loading details');
    }
    setDetailLoading(false);
  };

  const handleNodeKeyDown = (n, e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNodeClick(n);
    }
  };

  return (
    <div className="graph-wrapper" role="region" aria-label="Career roadmap graph" style={{ position: 'relative' }}>
      <div className="graph-toolbar" aria-live="polite">
        <span>
          Nodes: <strong>{data.counts.nodes}</strong>
        </span>
        <span>
          Edges: <strong>{data.counts.links}</strong>
        </span>
        <button className="btn ghost" onClick={resetZoom} aria-label="Reset zoom">
          Reset Zoom
        </button>
      </div>
      <div className="graph-legend" aria-hidden="false">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-primary)', display: 'inline-block' }} />
          <span>Role</span>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-success)', display: 'inline-block', marginLeft: 8 }} />
          <span>Skill</span>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f43f5e', display: 'inline-block', marginLeft: 8 }} />
          <span>Gap</span>
        </div>
      </div>
      <svg
        ref={svgRef}
        className="graph"
        role="img"
        aria-label="Interactive career roadmap graph canvas"
        viewBox={[-400, -300, 800, 600].join(' ')}
        tabIndex={0}
      >
        <defs>
          <marker id="arrow" viewBox="0 -5 10 10" refX="12" refY="0" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,-5L10,0L0,5" fill="var(--text-muted)" />
          </marker>
        </defs>
        <g ref={gRef}>
          {linkLines.map((l) => (
            <line
              key={l.key}
              className={`link ${l.kind === 'needs' ? 'arrow' : ''}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              strokeWidth={1.5}
              stroke={l.color || (l.is_gap ? '#ef4444' : undefined)}
              aria-hidden="true"
            />
          ))}
          {nodesWithPos.map((n) => {
            const colorProps = colorForNode(n);
            const r = 14 + Math.min(10, Math.max(0, (n.gap || 0) * 3));
            return (
              <g
                key={n.id}
                transform={`translate(${n.x || 0}, ${n.y || 0})`}
                onClick={() => handleNodeClick(n)}
                onKeyDown={(e) => handleNodeKeyDown(n, e)}
                role="button"
                tabIndex={0}
                aria-label={`${n.type} node: ${n.label}. ${n.is_gap ? 'Gap' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  r={r}
                  {...(colorProps.className ? { className: colorProps.className } : {})}
                  {...(colorProps.style ? { style: colorProps.style } : {})}
                />
                <text
                  x={0}
                  y={r + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {error ? (
        <div role="status" style={{ padding: 8, color: '#fbbf24' }}>
          {error}
        </div>
      ) : null}

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
